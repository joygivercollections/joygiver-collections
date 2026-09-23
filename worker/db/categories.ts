import type { AdminCategory, Audience, CategorySummary } from "../../shared/contracts";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  active?: number;
  display_order?: number;
  audiences_json: string;
}

function parseAudiences(value: string): Audience[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => !["women", "men", "kids"].includes(String(item)))) {
    throw new Error("Stored clothing type audiences are invalid");
  }
  return parsed as Audience[];
}

const SELECT_CATEGORY = `
  SELECT c.id, c.name, c.slug, c.active, c.display_order,
    COALESCE((
      SELECT json_group_array(audience)
      FROM (
        SELECT ca.audience AS audience
        FROM category_audiences ca
        WHERE ca.category_id = c.id
        ORDER BY ca.audience ASC
      )
    ), '[]') AS audiences_json
  FROM categories c
`;

function mapAdminCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active === 1,
    displayOrder: row.display_order ?? 0,
    audiences: parseAudiences(row.audiences_json),
  };
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueCategorySlug(
  db: D1Database,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || "category";
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const row = await db
      .prepare(
        `SELECT id FROM categories
         WHERE slug = ? COLLATE NOCASE
           AND (? IS NULL OR id != ?)
         LIMIT 1`,
      )
      .bind(candidate, excludeId ?? null, excludeId ?? null)
      .first<{ id: string }>();
    if (!row) return candidate;
  }
  throw new Error("Unable to generate a unique category address");
}

export async function listAllCategories(
  db: D1Database,
): Promise<AdminCategory[]> {
  const result = await db
    .prepare(
      `${SELECT_CATEGORY}
       ORDER BY c.display_order ASC, c.name ASC`,
    )
    .all<CategoryRow>();
  return result.results.map(mapAdminCategory);
}

export async function createCategory(
  db: D1Database,
  name: string,
  displayOrder: number,
  audiences: Audience[],
  now = new Date(),
): Promise<AdminCategory> {
  const id = crypto.randomUUID();
  const slug = await uniqueCategorySlug(db, name);
  const timestamp = now.toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO categories
         (id, name, slug, active, display_order, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(id, name, slug, displayOrder, timestamp, timestamp),
    ...audiences.map((audience) =>
      db
        .prepare("INSERT INTO category_audiences (category_id, audience) VALUES (?, ?)")
        .bind(id, audience),
    ),
  ]);
  return { id, name, slug, active: true, displayOrder, audiences: [...audiences].sort() };
}

export class CategoryAudienceConflictError extends Error {
  constructor(
    public readonly productCount: number,
    public readonly wholesaleCount: number,
  ) {
    super("Retail products and wholesale packages must be reassigned before removing this audience");
    this.name = "CategoryAudienceConflictError";
  }
}

export async function updateCategory(
  db: D1Database,
  id: string,
  input: { name: string; displayOrder: number; active: boolean; audiences: Audience[] },
  now = new Date(),
): Promise<AdminCategory | null> {
  const existing = await db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return null;
  const current = await db
    .prepare("SELECT audience FROM category_audiences WHERE category_id = ?")
    .bind(id)
    .all<{ audience: Audience }>();
  const nextAudiences = new Set(input.audiences);
  const removed = current.results
    .map((row) => row.audience)
    .filter((audience) => !nextAudiences.has(audience));
  if (removed.length) {
    const placeholders = removed.map(() => "?").join(", ");
    const productCount = Number(
      (await db
        .prepare(
          `SELECT COUNT(DISTINCT p.id) AS total
           FROM products p
           INNER JOIN product_audiences pa ON pa.product_id = p.id
           WHERE p.category_id = ? AND pa.audience IN (${placeholders})`,
        )
        .bind(id, ...removed)
        .first<number>("total")) ?? 0,
    );
    const wholesaleCount = Number(
      (await db
        .prepare(
          `SELECT COUNT(DISTINCT wc.package_id) AS total
           FROM wholesale_package_categories wc
           INNER JOIN wholesale_package_audiences wa ON wa.package_id = wc.package_id
           WHERE wc.category_id = ? AND wa.audience IN (${placeholders})`,
        )
        .bind(id, ...removed)
        .first<number>("total")) ?? 0,
    );
    if (productCount > 0 || wholesaleCount > 0) throw new CategoryAudienceConflictError(productCount, wholesaleCount);
  }
  const slug = await uniqueCategorySlug(db, input.name, id);
  await db.batch([
    db
      .prepare(
        `UPDATE categories
         SET name = ?, slug = ?, display_order = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.name,
        slug,
        input.displayOrder,
        input.active ? 1 : 0,
        now.toISOString(),
        id,
      ),
    db.prepare("DELETE FROM category_audiences WHERE category_id = ?").bind(id),
    ...input.audiences.map((audience) =>
      db
        .prepare("INSERT INTO category_audiences (category_id, audience) VALUES (?, ?)")
        .bind(id, audience),
    ),
  ]);
  return {
    id,
    name: input.name,
    slug,
    active: input.active,
    displayOrder: input.displayOrder,
    audiences: [...input.audiences].sort(),
  };
}

export async function retireCategory(
  db: D1Database,
  id: string,
  now = new Date(),
): Promise<{ retired: boolean; productCount: number; wholesaleCount: number; found: boolean }> {
  const category = await db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!category) return { retired: false, productCount: 0, wholesaleCount: 0, found: false };
  const productCount =
    (await db
      .prepare("SELECT COUNT(*) AS total FROM products WHERE category_id = ?")
      .bind(id)
      .first<number>("total")) ?? 0;
  const wholesaleCount =
    (await db
      .prepare("SELECT COUNT(DISTINCT package_id) AS total FROM wholesale_package_categories WHERE category_id = ?")
      .bind(id)
      .first<number>("total")) ?? 0;
  if (productCount > 0 || wholesaleCount > 0) return { retired: false, productCount, wholesaleCount, found: true };
  await db
    .prepare("UPDATE categories SET active = 0, updated_at = ? WHERE id = ?")
    .bind(now.toISOString(), id)
    .run();
  return { retired: true, productCount: 0, wholesaleCount: 0, found: true };
}

export async function listActiveCategories(
  db: D1Database,
  audience?: Audience,
): Promise<CategorySummary[]> {
  const result = await db
    .prepare(
      `${SELECT_CATEGORY}
       WHERE c.active = 1
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM category_audiences filter_ca
           WHERE filter_ca.category_id = c.id AND filter_ca.audience = ?
         ))
       ORDER BY c.display_order ASC, c.name ASC`,
    )
    .bind(audience ?? null, audience ?? null)
    .all<CategoryRow>();

  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    audiences: parseAudiences(row.audiences_json),
  }));
}
