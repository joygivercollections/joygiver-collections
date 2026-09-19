import type { CategorySummary } from "../../shared/contracts";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
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
