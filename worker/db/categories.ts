import type { AdminCategory, CategorySummary } from "../../shared/contracts";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  active?: number;
  display_order?: number;
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
      `SELECT id, name, slug, active, display_order
       FROM categories
       ORDER BY display_order ASC, name ASC`,
    )
    .all<CategoryRow>();
  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active === 1,
    displayOrder: row.display_order ?? 0,
  }));
}

export async function createCategory(
  db: D1Database,
  name: string,
  displayOrder: number,
  now = new Date(),
): Promise<AdminCategory> {
  const id = crypto.randomUUID();
  const slug = await uniqueCategorySlug(db, name);
  const timestamp = now.toISOString();
  await db
    .prepare(
      `INSERT INTO categories
       (id, name, slug, active, display_order, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
    )
    .bind(id, name, slug, displayOrder, timestamp, timestamp)
    .run();
  return { id, name, slug, active: true, displayOrder };
}

export async function updateCategory(
  db: D1Database,
  id: string,
  input: { name: string; displayOrder: number; active: boolean },
  now = new Date(),
): Promise<AdminCategory | null> {
  const existing = await db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return null;
  const slug = await uniqueCategorySlug(db, input.name, id);
  await db
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
    )
    .run();
  return { id, name: input.name, slug, active: input.active, displayOrder: input.displayOrder };
}

export async function retireCategory(
  db: D1Database,
  id: string,
  now = new Date(),
): Promise<{ retired: boolean; productCount: number; found: boolean }> {
  const category = await db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!category) return { retired: false, productCount: 0, found: false };
  const productCount =
    (await db
      .prepare("SELECT COUNT(*) AS total FROM products WHERE category_id = ?")
      .bind(id)
      .first<number>("total")) ?? 0;
  if (productCount > 0) return { retired: false, productCount, found: true };
  await db
    .prepare("UPDATE categories SET active = 0, updated_at = ? WHERE id = ?")
    .bind(now.toISOString(), id)
    .run();
  return { retired: true, productCount: 0, found: true };
}

export async function listActiveCategories(
  db: D1Database,
): Promise<CategorySummary[]> {
  const result = await db
    .prepare(
      `SELECT id, name, slug
       FROM categories
       WHERE active = 1
       ORDER BY display_order ASC, name ASC`,
    )
    .all<CategoryRow>();

  return result.results.map(({ id, name, slug }) => ({ id, name, slug }));
}
