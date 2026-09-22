import type { ProductImage } from "../../shared/contracts";

export type ImageOwner =
  | { ownerType: "product"; ownerId: string }
  | { ownerType: "wholesale"; ownerId: string };

type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

interface OwnerConfig {
  table: "product_images" | "wholesale_package_images";
  ownerColumn: "product_id" | "package_id";
  ownerTable: "products" | "wholesale_packages";
  keyPrefix: "products" | "wholesale";
  notFoundCode: "PRODUCT_NOT_FOUND" | "WHOLESALE_NOT_FOUND";
}

function configFor(owner: ImageOwner): OwnerConfig {
  return owner.ownerType === "product"
    ? { table: "product_images", ownerColumn: "product_id", ownerTable: "products", keyPrefix: "products", notFoundCode: "PRODUCT_NOT_FOUND" }
    : { table: "wholesale_package_images", ownerColumn: "package_id", ownerTable: "wholesale_packages", keyPrefix: "wholesale", notFoundCode: "WHOLESALE_NOT_FOUND" };
}

export class ImageStorageError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 413 | 415 | 409 | 503,
    message: string,
  ) {
    super(message);
    this.name = "ImageStorageError";
  }
}

export function imageUrl(objectKey: string): string {
  return `/media/${objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function detectImageType(bytes: Uint8Array): SupportedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function extensionFor(type: SupportedImageType): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return "webp";
}

export async function validateImageFile(file: File): Promise<SupportedImageType> {
  if (file.size > 8 * 1_024 * 1_024) throw new ImageStorageError("image_too_large", 413, "Each image must be 8 MiB or smaller");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ImageStorageError("unsupported_image_type", 415, "Use a JPEG, PNG, or WebP image");
  const detected = detectImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!detected || detected !== file.type) throw new ImageStorageError("unsupported_image_type", 415, "Image contents do not match the file type");
  return detected;
}

export async function listRegisteredImages(db: D1Database, owner: ImageOwner): Promise<ProductImage[]> {
  const config = configFor(owner);
  const result = await db.prepare(
    `SELECT id, object_key, alt_text, display_order FROM ${config.table}
     WHERE ${config.ownerColumn} = ? ORDER BY display_order ASC, id ASC`,
  ).bind(owner.ownerId).all<{ id: string; object_key: string; alt_text: string; display_order: number }>();
  return result.results.map((row) => ({ id: row.id, url: imageUrl(row.object_key), alt: row.alt_text, displayOrder: row.display_order }));
}

export async function storeRegisteredImage(
  db: D1Database,
  bucket: R2Bucket,
  owner: ImageOwner,
  file: File,
  altText?: string,
): Promise<ProductImage> {
  const detected = await validateImageFile(file);
  const config = configFor(owner);
  const record = await db.prepare(`SELECT name FROM ${config.ownerTable} WHERE id = ?`).bind(owner.ownerId).first<{ name: string }>();
  if (!record) throw new Error(config.notFoundCode);
  const count = (await db.prepare(`SELECT COUNT(*) AS total FROM ${config.table} WHERE ${config.ownerColumn} = ?`).bind(owner.ownerId).first<number>("total")) ?? 0;
  if (count >= 6) throw new ImageStorageError("image_limit_reached", 409, "An item can have at most six images");

  const id = crypto.randomUUID();
  const objectKey = `${config.keyPrefix}/${owner.ownerId}/${crypto.randomUUID()}.${extensionFor(detected)}`;
  try {
    await bucket.put(objectKey, file.stream(), { httpMetadata: { contentType: detected } });
  } catch {
    throw new ImageStorageError("image_storage_unavailable", 503, "Image storage is temporarily unavailable");
  }
  const timestamp = new Date().toISOString();
  const alt = altText?.trim() || record.name;
  try {
    await db.prepare(
      `INSERT INTO ${config.table}
       (id, ${config.ownerColumn}, object_key, alt_text, content_type, display_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, owner.ownerId, objectKey, alt, detected, count, timestamp, timestamp).run();
  } catch (error) {
    await bucket.delete(objectKey).catch(() => undefined);
    throw error;
  }
  return { id, url: imageUrl(objectKey), alt, displayOrder: count };
}

export async function deleteRegisteredImage(db: D1Database, bucket: R2Bucket, owner: ImageOwner, imageId: string): Promise<boolean> {
  const config = configFor(owner);
  const row = await db.prepare(`SELECT object_key FROM ${config.table} WHERE id = ? AND ${config.ownerColumn} = ?`).bind(imageId, owner.ownerId).first<{ object_key: string }>();
  if (!row) return false;
  await db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).bind(imageId).run();
  await bucket.delete(row.object_key).catch(() => undefined);
  return true;
}

export async function reorderRegisteredImages(db: D1Database, owner: ImageOwner, imageIds: string[]): Promise<ProductImage[] | null> {
  const config = configFor(owner);
  const current = await db.prepare(`SELECT id FROM ${config.table} WHERE ${config.ownerColumn} = ? ORDER BY display_order, id`).bind(owner.ownerId).all<{ id: string }>();
  const currentIds = current.results.map((row) => row.id).sort();
  const requestedIds = [...imageIds].sort();
  if (currentIds.length !== requestedIds.length || currentIds.some((id, index) => id !== requestedIds[index])) return null;
  await db.batch(imageIds.map((id, index) => db.prepare(`UPDATE ${config.table} SET display_order = ?, updated_at = ? WHERE id = ? AND ${config.ownerColumn} = ?`).bind(index, new Date().toISOString(), id, owner.ownerId)));
  return listRegisteredImages(db, owner);
}

export async function findRegisteredImage(db: D1Database, objectKey: string): Promise<{ id: string; objectKey: string; contentType: string } | null> {
  const row = await db.prepare(
    `SELECT id, object_key, content_type FROM product_images WHERE object_key = ?
     UNION ALL
     SELECT id, object_key, content_type FROM wholesale_package_images WHERE object_key = ?
     LIMIT 1`,
  ).bind(objectKey, objectKey).first<{ id: string; object_key: string; content_type: string }>();
  if (row) return { id: row.id, objectKey: row.object_key, contentType: row.content_type };
  const site = await db.prepare(
    `SELECT id, logo_object_key, logo_content_type, hero_object_key, hero_content_type FROM site_settings
     WHERE logo_object_key = ? OR hero_object_key = ? LIMIT 1`,
  ).bind(objectKey, objectKey).first<{ id: string; logo_object_key: string | null; logo_content_type: string | null; hero_object_key: string | null; hero_content_type: string | null }>();
  if (!site) return null;
  const isLogo = site.logo_object_key === objectKey;
  const contentType = isLogo ? site.logo_content_type : site.hero_content_type;
  return contentType ? { id: `${site.id}:${isLogo ? "logo" : "hero"}`, objectKey, contentType } : null;
}
