import type {
  CatalogueFilters,
  Paginated,
  Product,
  ProductImage,
  ProductSummary,
} from "../../shared/contracts";

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
  published_at: string;
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
    p.stock_quantity, p.state, p.sold_at, p.featured, p.published_at,
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
