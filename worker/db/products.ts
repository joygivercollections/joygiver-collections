import type {
  AdminProduct,
  CatalogueFilters,
  CartLine,
  InventorySummary,
  Paginated,
  Product,
  ProductImage,
  ProductSummary,
  ValidatedCart,
} from "../../shared/contracts";
import type { ProductInput } from "../../shared/validation";

const SOLD_VISIBILITY_MS = 48 * 60 * 60 * 1_000;

interface ProductRow {
  id: string;
  reference: string;
  slug: string;
  name: string;
  description: string;
  price_kobo: number;
  condition: "new" | "thrifted";
  category_id: string;
  category_name: string;
  category_slug: string;
  sizes_json: string;
  tags_json: string;
  stock_quantity: number;
  state: "available" | "sold" | "hidden";
  sold_at: string | null;
  featured: number;
  published: number;
  published_at: string | null;
  primary_image_key: string | null;
  primary_image_alt: string | null;
}

interface CountRow {
  total: number;
}

interface ImageRow {
  id: string;
  object_key: string;
  alt_text: string;
  display_order: number;
}

function parseStringArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Stored product list is invalid");
  }
  return parsed;
}

function imageUrl(objectKey: string): string {
  return `/media/${objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function mapSummary(row: ProductRow): ProductSummary {
  if (!row.published_at) {
    throw new Error("Published product is missing its publication time");
  }
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    name: row.name,
    priceKobo: row.price_kobo,
    condition: row.condition,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    sizes: parseStringArray(row.sizes_json),
    tags: parseStringArray(row.tags_json),
    stockQuantity: row.stock_quantity,
    state: row.state,
    soldAt: row.sold_at,
    primaryImage:
      row.primary_image_key === null
        ? null
        : {
            url: imageUrl(row.primary_image_key),
            alt: row.primary_image_alt ?? row.name,
          },
    publishedAt: row.published_at,
  };
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function publicPredicate(now: Date): { sql: string; values: unknown[] } {
  const cutoff = new Date(now.getTime() - SOLD_VISIBILITY_MS).toISOString();
  return {
    sql: `p.published = 1
      AND p.published_at IS NOT NULL
      AND (
        p.state = 'available'
        OR (p.state = 'sold' AND p.sold_at > ?)
      )`,
    values: [cutoff],
  };
}

function buildWhere(
  filters: CatalogueFilters,
  now: Date,
): { sql: string; values: unknown[] } {
  const predicate = publicPredicate(now);
  const clauses = [predicate.sql];
  const values = [...predicate.values];

  if (filters.condition) {
    clauses.push("p.condition = ?");
    values.push(filters.condition);
  }
  if (filters.category) {
    clauses.push("c.slug = ?");
    values.push(filters.category);
  }
  if (filters.size) {
    clauses.push(
      "EXISTS (SELECT 1 FROM json_each(p.sizes_json) AS size WHERE lower(size.value) = lower(?))",
    );
    values.push(filters.size);
  }
  if (filters.minPriceKobo !== undefined) {
    clauses.push("p.price_kobo >= ?");
    values.push(filters.minPriceKobo);
  }
  if (filters.maxPriceKobo !== undefined) {
    clauses.push("p.price_kobo <= ?");
    values.push(filters.maxPriceKobo);
  }
  if (filters.search?.trim()) {
    const pattern = `%${escapeLike(filters.search.trim())}%`;
    clauses.push(`(
      p.name LIKE ? ESCAPE '\\'
      OR p.reference LIKE ? ESCAPE '\\'
      OR p.description LIKE ? ESCAPE '\\'
      OR p.tags_json LIKE ? ESCAPE '\\'
      OR c.name LIKE ? ESCAPE '\\'
    )`);
    values.push(pattern, pattern, pattern, pattern, pattern);
  }

  return { sql: clauses.join(" AND "), values };
}

function orderBy(sort: CatalogueFilters["sort"]): string {
  if (sort === "price-asc") return "p.price_kobo ASC, p.published_at DESC";
  if (sort === "price-desc") return "p.price_kobo DESC, p.published_at DESC";
  return "p.published_at DESC, p.id DESC";
}

const SELECT_PRODUCT = `
  SELECT
    p.id, p.reference, p.slug, p.name, p.description, p.price_kobo,
    p.condition, p.category_id, c.name AS category_name,
    c.slug AS category_slug, p.sizes_json, p.tags_json,
    p.stock_quantity, p.state, p.sold_at, p.featured, p.published, p.published_at,
    (
      SELECT pi.object_key FROM product_images pi
      WHERE pi.product_id = p.id
      ORDER BY pi.display_order ASC, pi.id ASC LIMIT 1
    ) AS primary_image_key,
    (
      SELECT pi.alt_text FROM product_images pi
      WHERE pi.product_id = p.id
      ORDER BY pi.display_order ASC, pi.id ASC LIMIT 1
    ) AS primary_image_alt
  FROM products p
  INNER JOIN categories c ON c.id = p.category_id
`;

export async function listPublicProducts(
  db: D1Database,
  filters: CatalogueFilters,
  now = new Date(),
): Promise<Paginated<ProductSummary>> {
  const page = filters.page ?? 1;
  const pageSize = filters.limit ?? 24;
  const where = buildWhere(filters, now);
  const offset = (page - 1) * pageSize;

  const countStatement = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE ${where.sql}`,
    )
    .bind(...where.values);

  const rowsStatement = db
    .prepare(
      `${SELECT_PRODUCT}
       WHERE ${where.sql}
       ORDER BY ${orderBy(filters.sort)}
       LIMIT ? OFFSET ?`,
    )
    .bind(...where.values, pageSize, offset);

  const results = await db.batch([
    countStatement,
    rowsStatement,
  ]);
  const countResult = results[0] as D1Result<CountRow>;
  const rowsResult = results[1] as D1Result<ProductRow>;

  return {
    items: rowsResult.results.map(mapSummary),
    page,
    pageSize,
    total: Number(countResult.results[0]?.total ?? 0),
  };
}

export async function getPublicProduct(
  db: D1Database,
  slug: string,
  now = new Date(),
): Promise<Product | null> {
  const predicate = publicPredicate(now);
  const row = await db
    .prepare(
      `${SELECT_PRODUCT}
       WHERE ${predicate.sql} AND p.slug = ?
       LIMIT 1`,
    )
    .bind(...predicate.values, slug)
    .first<ProductRow>();

  if (!row) return null;

  const images = await db
    .prepare(
      `SELECT id, object_key, alt_text, display_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY display_order ASC, id ASC`,
    )
    .bind(row.id)
    .all<ImageRow>();

  const mappedImages: ProductImage[] = images.results.map((image) => ({
    id: image.id,
    url: imageUrl(image.object_key),
    alt: image.alt_text,
    displayOrder: image.display_order,
  }));

  return {
    ...mapSummary(row),
    description: row.description,
    featured: row.featured === 1,
    images: mappedImages,
  };
}

async function listProductImages(
  db: D1Database,
  productId: string,
): Promise<ProductImage[]> {
  const images = await db
    .prepare(
      `SELECT id, object_key, alt_text, display_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY display_order ASC, id ASC`,
    )
    .bind(productId)
    .all<ImageRow>();
  return images.results.map((image) => ({
    id: image.id,
    url: imageUrl(image.object_key),
    alt: image.alt_text,
    displayOrder: image.display_order,
  }));
}

async function mapAdminProduct(
  db: D1Database,
  row: ProductRow,
): Promise<AdminProduct> {
  const summary = row.published_at
    ? mapSummary(row)
    : {
        id: row.id,
        reference: row.reference,
        slug: row.slug,
        name: row.name,
        priceKobo: row.price_kobo,
        condition: row.condition,
        category: {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
        },
        sizes: parseStringArray(row.sizes_json),
        tags: parseStringArray(row.tags_json),
        stockQuantity: row.stock_quantity,
        state: row.state,
        soldAt: row.sold_at,
        primaryImage:
          row.primary_image_key === null
            ? null
            : {
                url: imageUrl(row.primary_image_key),
                alt: row.primary_image_alt ?? row.name,
              },
        publishedAt: "",
      };
  return {
    ...summary,
    description: row.description,
    featured: row.featured === 1,
    published: row.published === 1,
    publishedAt: row.published_at,
    images: await listProductImages(db, row.id),
  };
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function uniqueProductSlug(
  db: D1Database,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || "product";
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const row = await db
      .prepare(
        `SELECT id FROM products
         WHERE slug = ? COLLATE NOCASE
           AND (? IS NULL OR id != ?)
         LIMIT 1`,
      )
      .bind(candidate, excludeId ?? null, excludeId ?? null)
      .first<{ id: string }>();
    if (!row) return candidate;
  }
  throw new Error("Unable to generate a unique product address");
}

function generatedReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `JGC-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

async function uniqueReference(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const reference = generatedReference();
    const existing = await db
      .prepare("SELECT id FROM products WHERE reference = ? COLLATE NOCASE")
      .bind(reference)
      .first<{ id: string }>();
    if (!existing) return reference;
  }
  throw new Error("Unable to generate a unique product reference");
}

async function productRowById(
  db: D1Database,
  id: string,
): Promise<ProductRow | null> {
  return db
    .prepare(`${SELECT_PRODUCT} WHERE p.id = ? LIMIT 1`)
    .bind(id)
    .first<ProductRow>();
}

export async function getAdminProduct(
  db: D1Database,
  id: string,
): Promise<AdminProduct | null> {
  const row = await productRowById(db, id);
  return row ? mapAdminProduct(db, row) : null;
}

export async function createAdminProduct(
  db: D1Database,
  input: ProductInput,
  now = new Date(),
): Promise<AdminProduct> {
  const id = crypto.randomUUID();
  const reference = input.reference?.trim().toUpperCase() || (await uniqueReference(db));
  const slug = await uniqueProductSlug(db, input.name);
  const timestamp = now.toISOString();
  const publishedAt = input.published ? timestamp : null;
  await db.batch([
    db
      .prepare(
        `INSERT INTO products (
          id, reference, slug, name, description, price_kobo, condition,
          category_id, sizes_json, tags_json, stock_quantity, state,
          featured, published, published_at, sold_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, NULL, ?, ?)`,
      )
      .bind(
        id,
        reference,
        slug,
        input.name,
        input.description,
        input.priceKobo,
        input.condition,
        input.categoryId,
        JSON.stringify(input.sizes),
        JSON.stringify(input.tags),
        input.stockQuantity,
        input.featured ? 1 : 0,
        input.published ? 1 : 0,
        publishedAt,
        timestamp,
        timestamp,
      ),
  ]);
  const created = await getAdminProduct(db, id);
  if (!created) throw new Error("Created product could not be read");
  return created;
}

export async function updateAdminProduct(
  db: D1Database,
  id: string,
  input: ProductInput,
  now = new Date(),
): Promise<AdminProduct | null> {
  const existing = await productRowById(db, id);
  if (!existing) return null;
  const reference = input.reference?.trim().toUpperCase() || existing.reference;
  const slug = await uniqueProductSlug(db, input.name, id);
  const publishedAt = input.published
    ? existing.published_at ?? now.toISOString()
    : existing.published_at;
  await db.batch([
    db
      .prepare(
        `UPDATE products SET
          reference = ?, slug = ?, name = ?, description = ?, price_kobo = ?,
          condition = ?, category_id = ?, sizes_json = ?, tags_json = ?,
          stock_quantity = ?, featured = ?, published = ?, published_at = ?,
          updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        reference,
        slug,
        input.name,
        input.description,
        input.priceKobo,
        input.condition,
        input.categoryId,
        JSON.stringify(input.sizes),
        JSON.stringify(input.tags),
        input.stockQuantity,
        input.featured ? 1 : 0,
        input.published ? 1 : 0,
        publishedAt,
        now.toISOString(),
        id,
      ),
  ]);
  return getAdminProduct(db, id);
}

export async function changeProductState(
  db: D1Database,
  id: string,
  state: "available" | "sold" | "hidden",
  now = new Date(),
): Promise<AdminProduct | null> {
  const existing = await productRowById(db, id);
  if (!existing) return null;
  const soldAt = state === "sold" ? now.toISOString() : null;
  await db
    .prepare(
      `UPDATE products
       SET state = ?, sold_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(state, soldAt, now.toISOString(), id)
    .run();
  return getAdminProduct(db, id);
}

export async function deleteAdminProduct(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const result = await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getInventorySummary(
  db: D1Database,
): Promise<InventorySummary> {
  const row = await db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN state = 'available' THEN 1 ELSE 0 END) AS available,
        SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) AS sold,
        SUM(CASE WHEN state = 'hidden' THEN 1 ELSE 0 END) AS hidden,
        SUM(CASE WHEN condition = 'new' THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN condition = 'thrifted' THEN 1 ELSE 0 END) AS thrifted_count
       FROM products`,
    )
    .first<Record<string, number | null>>();
  return {
    total: Number(row?.total ?? 0),
    available: Number(row?.available ?? 0),
    sold: Number(row?.sold ?? 0),
    hidden: Number(row?.hidden ?? 0),
    new: Number(row?.new_count ?? 0),
    thrifted: Number(row?.thrifted_count ?? 0),
  };
}

export async function listAdminProducts(
  db: D1Database,
  options: {
    search?: string;
    state?: "available" | "sold" | "hidden";
    condition?: "new" | "thrifted";
    category?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<Paginated<AdminProduct>> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (options.search?.trim()) {
    const pattern = `%${escapeLike(options.search.trim())}%`;
    clauses.push("(p.name LIKE ? ESCAPE '\\' OR p.reference LIKE ? ESCAPE '\\')");
    values.push(pattern, pattern);
  }
  if (options.state) {
    clauses.push("p.state = ?");
    values.push(options.state);
  }
  if (options.condition) {
    clauses.push("p.condition = ?");
    values.push(options.condition);
  }
  if (options.category) {
    clauses.push("c.slug = ?");
    values.push(options.category);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const page = options.page ?? 1;
  const pageSize = options.limit ?? 24;
  const [countResult, rowsResult] = await db.batch([
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM products p
         INNER JOIN categories c ON c.id = p.category_id ${where}`,
      )
      .bind(...values),
    db
      .prepare(
        `${SELECT_PRODUCT} ${where}
         ORDER BY p.updated_at DESC, p.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...values, pageSize, (page - 1) * pageSize),
  ]);
  const rows = (rowsResult as D1Result<ProductRow>).results;
  return {
    items: await Promise.all(rows.map((row) => mapAdminProduct(db, row))),
    page,
    pageSize,
    total: Number((countResult as D1Result<CountRow>).results[0]?.total ?? 0),
  };
}

interface CartValidationInput {
  productId: string;
  size: string;
  quantity: number;
  lastKnownPriceKobo: number;
}

export async function validateCart(
  db: D1Database,
  items: CartValidationInput[],
): Promise<ValidatedCart> {
  const ids = Array.from(new Set(items.map((item) => item.productId)));
  const placeholders = ids.map(() => "?").join(", ");
  const rows = ids.length
    ? await db
        .prepare(`${SELECT_PRODUCT} WHERE p.id IN (${placeholders})`)
        .bind(...ids)
        .all<ProductRow>()
    : { results: [] as ProductRow[] };
  const byId = new Map(rows.results.map((row) => [row.id, row]));
  const valid: ValidatedCart["valid"] = [];
  const invalid: ValidatedCart["invalid"] = [];

  for (const input of items) {
    const row = byId.get(input.productId);
    const baseLine: CartLine = {
      productId: input.productId,
      reference: row?.reference ?? "Unavailable",
      name: row?.name ?? "Unavailable product",
      size: input.size,
      quantity: input.quantity,
      lastKnownPriceKobo: input.lastKnownPriceKobo,
      imageUrl: row?.primary_image_key ? imageUrl(row.primary_image_key) : null,
      selected: true,
    };
    if (!row) {
      invalid.push({ ...baseLine, reason: "deleted" });
      continue;
    }
    if (row.state === "sold") {
      invalid.push({ ...baseLine, reason: "sold" });
      continue;
    }
    if (row.state === "hidden" || row.published !== 1) {
      invalid.push({ ...baseLine, reason: "hidden" });
      continue;
    }
    if (!parseStringArray(row.sizes_json).some((size) => size.toLowerCase() === input.size.toLowerCase())) {
      invalid.push({ ...baseLine, reason: "size_unavailable" });
      continue;
    }
    const availableQuantity = row.condition === "thrifted" ? Math.min(1, row.stock_quantity) : row.stock_quantity;
    if (availableQuantity <= 0) {
      invalid.push({ ...baseLine, reason: "out_of_stock" });
      continue;
    }
    if (input.quantity > availableQuantity) {
      invalid.push({ ...baseLine, quantity: availableQuantity, reason: "quantity_reduced" });
      continue;
    }
    valid.push({
      ...baseLine,
      reference: row.reference,
      name: row.name,
      canonicalPriceKobo: row.price_kobo,
      priceChanged: row.price_kobo !== input.lastKnownPriceKobo,
    });
  }
  return {
    valid,
    invalid,
    subtotalKobo: valid.reduce(
      (sum, line) => sum + line.canonicalPriceKobo * line.quantity,
      0,
    ),
  };
}

export class ProductImageError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 413 | 415 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}

function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function extensionFor(type: "image/jpeg" | "image/png" | "image/webp"): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return "webp";
}

export async function storeProductImage(
  db: D1Database,
  bucket: R2Bucket,
  productId: string,
  file: File,
  altText?: string,
): Promise<ProductImage> {
  if (file.size > 8 * 1_024 * 1_024) {
    throw new ProductImageError("image_too_large", 413, "Each image must be 8 MiB or smaller");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new ProductImageError("unsupported_image_type", 415, "Use a JPEG, PNG, or WebP image");
  }
  const detected = detectImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!detected || detected !== file.type) {
    throw new ProductImageError("unsupported_image_type", 415, "Image contents do not match the file type");
  }
  const product = await productRowById(db, productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const count =
    (await db
      .prepare("SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?")
      .bind(productId)
      .first<number>("total")) ?? 0;
  if (count >= 6) {
    throw new ProductImageError("image_limit_reached", 409, "A product can have at most six images");
  }

  const id = crypto.randomUUID();
  const objectKey = `products/${productId}/${crypto.randomUUID()}.${extensionFor(detected)}`;
  try {
    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: detected },
    });
  } catch {
    throw new ProductImageError("image_storage_unavailable", 503, "Image storage is temporarily unavailable");
  }

  const timestamp = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO product_images
         (id, product_id, object_key, alt_text, content_type, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        productId,
        objectKey,
        altText?.trim() || product.name,
        detected,
        count,
        timestamp,
        timestamp,
      )
      .run();
  } catch (error) {
    await bucket.delete(objectKey).catch(() => undefined);
    throw error;
  }
  return {
    id,
    url: imageUrl(objectKey),
    alt: altText?.trim() || product.name,
    displayOrder: count,
  };
}

export async function findRegisteredImage(
  db: D1Database,
  objectKey: string,
): Promise<{ id: string; objectKey: string; contentType: string } | null> {
  const row = await db
    .prepare(
      `SELECT id, object_key, content_type
       FROM product_images
       WHERE object_key = ?
       LIMIT 1`,
    )
    .bind(objectKey)
    .first<{ id: string; object_key: string; content_type: string }>();
  return row
    ? { id: row.id, objectKey: row.object_key, contentType: row.content_type }
    : null;
}

export async function deleteProductImage(
  db: D1Database,
  bucket: R2Bucket,
  productId: string,
  imageId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT object_key FROM product_images
       WHERE id = ? AND product_id = ?`,
    )
    .bind(imageId, productId)
    .first<{ object_key: string }>();
  if (!row) return false;
  try {
    await bucket.delete(row.object_key);
  } catch {
    throw new ProductImageError("image_storage_unavailable", 503, "Image storage is temporarily unavailable");
  }
  await db.prepare("DELETE FROM product_images WHERE id = ?").bind(imageId).run();
  return true;
}

export async function reorderProductImages(
  db: D1Database,
  productId: string,
  imageIds: string[],
): Promise<ProductImage[] | null> {
  const current = await db
    .prepare("SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order, id")
    .bind(productId)
    .all<{ id: string }>();
  const currentIds = current.results.map((row) => row.id).sort();
  if (
    currentIds.length !== imageIds.length ||
    currentIds.some((id, index) => id !== [...imageIds].sort()[index])
  ) {
    return null;
  }
  await db.batch(
    imageIds.map((id, index) =>
      db
        .prepare(
          "UPDATE product_images SET display_order = ?, updated_at = ? WHERE id = ? AND product_id = ?",
        )
        .bind(index, new Date().toISOString(), id, productId),
    ),
  );
  return listProductImages(db, productId);
}
