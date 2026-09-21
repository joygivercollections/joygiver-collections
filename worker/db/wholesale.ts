import type {
  AdminWholesalePackage,
  Audience,
  CategorySummary,
  Paginated,
  ProductImage,
  WholesaleFilters,
  WholesalePackage,
  WholesalePackageSummary,
} from "../../shared/contracts";
import type { WholesalePackageInput } from "../../shared/validation";
import {
  deleteRegisteredImage,
  imageUrl,
  listRegisteredImages,
  reorderRegisteredImages,
  storeRegisteredImage,
} from "../lib/images";
import { getActivePromotion } from "./promotions";

const SOLD_VISIBILITY_MS = 48 * 60 * 60 * 1_000;

interface WholesaleRow {
  id: string;
  reference: string;
  slug: string;
  name: string;
  description: string;
  condition_scope: "new" | "thrifted" | "mixed";
  piece_count: number;
  price_kobo: number;
  stock_quantity: number;
  state: "available" | "sold" | "hidden";
  sold_at: string | null;
  featured: number;
  published: number;
  published_at: string | null;
  audiences_json: string;
  categories_json: string;
  primary_image_key: string | null;
  primary_image_alt: string | null;
}

interface CountRow { total: number }

function parseJsonArray<T>(value: string): T[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("Stored wholesale list is invalid");
  return parsed as T[];
}

const SELECT_WHOLESALE = `
  SELECT
    w.id, w.reference, w.slug, w.name, w.description, w.condition_scope,
    w.piece_count, w.price_kobo, w.stock_quantity, w.state, w.sold_at,
    w.featured, w.published, w.published_at,
    COALESCE((SELECT json_group_array(audience) FROM (
      SELECT wa.audience AS audience FROM wholesale_package_audiences wa
      WHERE wa.package_id = w.id ORDER BY wa.audience ASC
    )), '[]') AS audiences_json,
    COALESCE((SELECT json_group_array(json_object('id', id, 'name', name, 'slug', slug)) FROM (
      SELECT c.id, c.name, c.slug FROM wholesale_package_categories wc
      INNER JOIN categories c ON c.id = wc.category_id
      WHERE wc.package_id = w.id ORDER BY c.display_order ASC, c.name ASC
    )), '[]') AS categories_json,
    (SELECT wi.object_key FROM wholesale_package_images wi WHERE wi.package_id = w.id ORDER BY wi.display_order ASC, wi.id ASC LIMIT 1) AS primary_image_key,
    (SELECT wi.alt_text FROM wholesale_package_images wi WHERE wi.package_id = w.id ORDER BY wi.display_order ASC, wi.id ASC LIMIT 1) AS primary_image_alt
  FROM wholesale_packages w
`;

function mapSummary(row: WholesaleRow, promoEligible = false): WholesalePackageSummary {
  if (!row.published_at) throw new Error("Published wholesale package is missing its publication time");
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    name: row.name,
    description: row.description,
    audiences: parseJsonArray<Audience>(row.audiences_json),
    conditionScope: row.condition_scope,
    categories: parseJsonArray<CategorySummary>(row.categories_json),
    pieceCount: row.piece_count,
    priceKobo: row.price_kobo,
    stockQuantity: row.stock_quantity,
    state: row.state,
    soldAt: row.sold_at,
    featured: row.featured === 1,
    ...(promoEligible ? { promoEligible: true } : {}),
    primaryImage: row.primary_image_key ? { url: imageUrl(row.primary_image_key), alt: row.primary_image_alt ?? row.name } : null,
    publishedAt: row.published_at,
  };
}

async function mapAdmin(db: D1Database, row: WholesaleRow, promoEligible = false): Promise<AdminWholesalePackage> {
  const summary = row.published_at ? mapSummary(row, promoEligible) : {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    name: row.name,
    description: row.description,
    audiences: parseJsonArray<Audience>(row.audiences_json),
    conditionScope: row.condition_scope,
    categories: parseJsonArray<CategorySummary>(row.categories_json),
    pieceCount: row.piece_count,
    priceKobo: row.price_kobo,
    stockQuantity: row.stock_quantity,
    state: row.state,
    soldAt: row.sold_at,
    featured: row.featured === 1,
    ...(promoEligible ? { promoEligible: true } : {}),
    primaryImage: row.primary_image_key ? { url: imageUrl(row.primary_image_key), alt: row.primary_image_alt ?? row.name } : null,
    publishedAt: "",
  };
  return {
    ...summary,
    published: row.published === 1,
    publishedAt: row.published_at,
    images: await listRegisteredImages(db, { ownerType: "wholesale", ownerId: row.id }),
  };
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function publicWhere(filters: WholesaleFilters, now: Date) {
  const values: unknown[] = [new Date(now.getTime() - SOLD_VISIBILITY_MS).toISOString()];
  const clauses = [`w.published = 1 AND w.published_at IS NOT NULL AND (w.state = 'available' OR (w.state = 'sold' AND w.sold_at > ?))`];
  if (filters.audience) { clauses.push("EXISTS (SELECT 1 FROM wholesale_package_audiences wa WHERE wa.package_id = w.id AND wa.audience = ?)"); values.push(filters.audience); }
  if (filters.condition) { clauses.push("w.condition_scope = ?"); values.push(filters.condition); }
  if (filters.category) { clauses.push("EXISTS (SELECT 1 FROM wholesale_package_categories wc INNER JOIN categories c ON c.id = wc.category_id WHERE wc.package_id = w.id AND c.slug = ?)"); values.push(filters.category); }
  if (filters.minPieceCount !== undefined) { clauses.push("w.piece_count >= ?"); values.push(filters.minPieceCount); }
  if (filters.maxPieceCount !== undefined) { clauses.push("w.piece_count <= ?"); values.push(filters.maxPieceCount); }
  if (filters.minPriceKobo !== undefined) { clauses.push("w.price_kobo >= ?"); values.push(filters.minPriceKobo); }
  if (filters.maxPriceKobo !== undefined) { clauses.push("w.price_kobo <= ?"); values.push(filters.maxPriceKobo); }
  if (filters.availability) { clauses.push("w.state = ?"); values.push(filters.availability); }
  if (filters.search?.trim()) {
    const pattern = `%${escapeLike(filters.search.trim())}%`;
    clauses.push(`(w.name LIKE ? ESCAPE '\\' OR w.reference LIKE ? ESCAPE '\\' OR w.description LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM wholesale_package_categories wc INNER JOIN categories c ON c.id = wc.category_id
      WHERE wc.package_id = w.id AND c.name LIKE ? ESCAPE '\\'
    ))`);
    values.push(pattern, pattern, pattern, pattern);
  }
  return { sql: clauses.join(" AND "), values };
}

function orderBy(sort: WholesaleFilters["sort"]) {
  if (sort === "price-asc") return "w.price_kobo ASC, w.published_at DESC";
  if (sort === "price-desc") return "w.price_kobo DESC, w.published_at DESC";
  return "w.published_at DESC, w.id DESC";
}

export async function listPublicWholesale(db: D1Database, filters: WholesaleFilters, now = new Date()): Promise<Paginated<WholesalePackageSummary>> {
  const page = filters.page ?? 1;
  const pageSize = filters.limit ?? 24;
  const where = publicWhere(filters, now);
  const [countResult, rowsResult] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total FROM wholesale_packages w WHERE ${where.sql}`).bind(...where.values),
    db.prepare(`${SELECT_WHOLESALE} WHERE ${where.sql} ORDER BY ${orderBy(filters.sort)} LIMIT ? OFFSET ?`).bind(...where.values, pageSize, (page - 1) * pageSize),
  ]);
  const promotion = await getActivePromotion(db, now);
  const eligible = new Set(promotion?.wholesalePackageIds ?? []);
  return {
    items: (rowsResult as D1Result<WholesaleRow>).results.map((row) => mapSummary(row, eligible.has(row.id))),
    page,
    pageSize,
    total: Number((countResult as D1Result<CountRow>).results[0]?.total ?? 0),
  };
}

export async function getPublicWholesalePackage(db: D1Database, slug: string, now = new Date()): Promise<WholesalePackage | null> {
  const where = publicWhere({}, now);
  const row = await db.prepare(`${SELECT_WHOLESALE} WHERE ${where.sql} AND w.slug = ? LIMIT 1`).bind(...where.values, slug).first<WholesaleRow>();
  if (!row) return null;
  const promotion = await getActivePromotion(db, now);
  return { ...mapSummary(row, promotion?.wholesalePackageIds.includes(row.id) ?? false), images: await listRegisteredImages(db, { ownerType: "wholesale", ownerId: row.id }) };
}

async function rowById(db: D1Database, id: string) {
  return db.prepare(`${SELECT_WHOLESALE} WHERE w.id = ? LIMIT 1`).bind(id).first<WholesaleRow>();
}

export async function getAdminWholesalePackage(db: D1Database, id: string): Promise<AdminWholesalePackage | null> {
  const row = await rowById(db, id);
  if (!row) return null;
  const promotion = await getActivePromotion(db, new Date());
  return mapAdmin(db, row, promotion?.wholesalePackageIds.includes(row.id) ?? false);
}

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

async function uniqueSlug(db: D1Database, name: string, excludeId?: string) {
  const base = slugify(name) || "wholesale-package";
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const exists = await db.prepare("SELECT id FROM wholesale_packages WHERE slug = ? COLLATE NOCASE AND (? IS NULL OR id != ?) LIMIT 1").bind(candidate, excludeId ?? null, excludeId ?? null).first();
    if (!exists) return candidate;
  }
  throw new Error("Unable to generate a unique wholesale address");
}

async function uniqueReference(db: D1Database) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const reference = `JGC-W-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    if (!await db.prepare("SELECT id FROM wholesale_packages WHERE reference = ? COLLATE NOCASE").bind(reference).first()) return reference;
  }
  throw new Error("Unable to generate a unique wholesale reference");
}

export class WholesaleTypeAudienceError extends Error {
  constructor() { super("Every selected clothing type must be available for every selected audience"); this.name = "WholesaleTypeAudienceError"; }
}

async function ensureCategoryCompatibility(db: D1Database, categoryIds: string[], audiences: Audience[]) {
  const placeholders = categoryIds.map(() => "?").join(", ");
  const rows = await db.prepare(`SELECT category_id, audience FROM category_audiences WHERE category_id IN (${placeholders})`).bind(...categoryIds).all<{ category_id: string; audience: Audience }>();
  const assignments = new Map<string, Set<Audience>>();
  for (const row of rows.results) {
    if (!assignments.has(row.category_id)) assignments.set(row.category_id, new Set());
    assignments.get(row.category_id)?.add(row.audience);
  }
  if (categoryIds.some((id) => audiences.some((audience) => !assignments.get(id)?.has(audience)))) throw new WholesaleTypeAudienceError();
}

export async function createAdminWholesalePackage(db: D1Database, input: WholesalePackageInput, now = new Date()): Promise<AdminWholesalePackage> {
  await ensureCategoryCompatibility(db, input.categoryIds, input.audiences);
  const id = crypto.randomUUID();
  const reference = input.reference?.trim().toUpperCase() || await uniqueReference(db);
  const slug = await uniqueSlug(db, input.name);
  const timestamp = now.toISOString();
  await db.batch([
    db.prepare(`INSERT INTO wholesale_packages (
      id, reference, slug, name, description, condition_scope, piece_count, price_kobo,
      stock_quantity, state, featured, published, published_at, sold_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, NULL, ?, ?)`)
      .bind(id, reference, slug, input.name, input.description, input.conditionScope, input.pieceCount, input.priceKobo, input.stockQuantity, input.featured ? 1 : 0, input.published ? 1 : 0, input.published ? timestamp : null, timestamp, timestamp),
    ...input.audiences.map((audience) => db.prepare("INSERT INTO wholesale_package_audiences (package_id, audience) VALUES (?, ?)").bind(id, audience)),
    ...input.categoryIds.map((categoryId) => db.prepare("INSERT INTO wholesale_package_categories (package_id, category_id) VALUES (?, ?)").bind(id, categoryId)),
  ]);
  const created = await getAdminWholesalePackage(db, id);
  if (!created) throw new Error("Created wholesale package could not be read");
  return created;
}

export async function updateAdminWholesalePackage(db: D1Database, id: string, input: WholesalePackageInput, now = new Date()): Promise<AdminWholesalePackage | null> {
  const existing = await rowById(db, id);
  if (!existing) return null;
  await ensureCategoryCompatibility(db, input.categoryIds, input.audiences);
  const timestamp = now.toISOString();
  const publishedAt = input.published ? existing.published_at ?? timestamp : existing.published_at;
  await db.batch([
    db.prepare(`UPDATE wholesale_packages SET reference = ?, slug = ?, name = ?, description = ?, condition_scope = ?, piece_count = ?, price_kobo = ?, stock_quantity = ?, featured = ?, published = ?, published_at = ?, updated_at = ? WHERE id = ?`)
      .bind(input.reference?.trim().toUpperCase() || existing.reference, await uniqueSlug(db, input.name, id), input.name, input.description, input.conditionScope, input.pieceCount, input.priceKobo, input.stockQuantity, input.featured ? 1 : 0, input.published ? 1 : 0, publishedAt, timestamp, id),
    db.prepare("DELETE FROM wholesale_package_audiences WHERE package_id = ?").bind(id),
    db.prepare("DELETE FROM wholesale_package_categories WHERE package_id = ?").bind(id),
    ...input.audiences.map((audience) => db.prepare("INSERT INTO wholesale_package_audiences (package_id, audience) VALUES (?, ?)").bind(id, audience)),
    ...input.categoryIds.map((categoryId) => db.prepare("INSERT INTO wholesale_package_categories (package_id, category_id) VALUES (?, ?)").bind(id, categoryId)),
  ]);
  return getAdminWholesalePackage(db, id);
}

export async function changeWholesaleState(db: D1Database, id: string, state: "available" | "sold" | "hidden", now = new Date()) {
  if (!await rowById(db, id)) return null;
  await db.prepare("UPDATE wholesale_packages SET state = ?, sold_at = ?, updated_at = ? WHERE id = ?").bind(state, state === "sold" ? now.toISOString() : null, now.toISOString(), id).run();
  return getAdminWholesalePackage(db, id);
}

export async function deleteAdminWholesalePackage(db: D1Database, id: string) {
  const result = await db.prepare("DELETE FROM wholesale_packages WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listAdminWholesalePackages(db: D1Database, filters: WholesaleFilters & { state?: "available" | "sold" | "hidden" } = {}): Promise<Paginated<AdminWholesalePackage>> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.audience) { clauses.push("EXISTS (SELECT 1 FROM wholesale_package_audiences wa WHERE wa.package_id = w.id AND wa.audience = ?)"); values.push(filters.audience); }
  if (filters.condition) { clauses.push("w.condition_scope = ?"); values.push(filters.condition); }
  if (filters.category) { clauses.push("EXISTS (SELECT 1 FROM wholesale_package_categories wc INNER JOIN categories c ON c.id = wc.category_id WHERE wc.package_id = w.id AND c.slug = ?)"); values.push(filters.category); }
  if (filters.state) { clauses.push("w.state = ?"); values.push(filters.state); }
  if (filters.search?.trim()) { const pattern = `%${escapeLike(filters.search.trim())}%`; clauses.push("(w.name LIKE ? ESCAPE '\\' OR w.reference LIKE ? ESCAPE '\\')"); values.push(pattern, pattern); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const page = filters.page ?? 1;
  const pageSize = filters.limit ?? 24;
  const [countResult, rowsResult] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total FROM wholesale_packages w ${where}`).bind(...values),
    db.prepare(`${SELECT_WHOLESALE} ${where} ORDER BY w.updated_at DESC, w.id DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, (page - 1) * pageSize),
  ]);
  const promotion = await getActivePromotion(db, new Date());
  const eligible = new Set(promotion?.wholesalePackageIds ?? []);
  return { items: await Promise.all((rowsResult as D1Result<WholesaleRow>).results.map((row) => mapAdmin(db, row, eligible.has(row.id)))), page, pageSize, total: Number((countResult as D1Result<CountRow>).results[0]?.total ?? 0) };
}

export async function getWholesaleForCart(db: D1Database, ids: string[]): Promise<AdminWholesalePackage[]> {
  if (!ids.length) return [];
  const rows = await db.prepare(`${SELECT_WHOLESALE} WHERE w.id IN (${ids.map(() => "?").join(", ")})`).bind(...ids).all<WholesaleRow>();
  const promotion = await getActivePromotion(db, new Date());
  const eligible = new Set(promotion?.wholesalePackageIds ?? []);
  return Promise.all(rows.results.map((row) => mapAdmin(db, row, eligible.has(row.id))));
}

export function storeWholesaleImage(db: D1Database, bucket: R2Bucket, packageId: string, file: File, altText?: string): Promise<ProductImage> {
  return storeRegisteredImage(db, bucket, { ownerType: "wholesale", ownerId: packageId }, file, altText);
}

export function deleteWholesaleImage(db: D1Database, bucket: R2Bucket, packageId: string, imageId: string) {
  return deleteRegisteredImage(db, bucket, { ownerType: "wholesale", ownerId: packageId }, imageId);
}

export function reorderWholesaleImages(db: D1Database, packageId: string, imageIds: string[]) {
  return reorderRegisteredImages(db, { ownerType: "wholesale", ownerId: packageId }, imageIds);
}
