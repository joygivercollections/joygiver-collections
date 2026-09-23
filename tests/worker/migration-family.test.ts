import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { expect, it } from "vitest";

it("backfills legacy products to Women and shares reusable clothing types", async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, 1));

  const timestamp = "2026-09-20T00:00:00.000Z";
  await env.DB.prepare(
    `INSERT INTO products (
      id, reference, slug, name, description, price_kobo, condition,
      category_id, sizes_json, tags_json, stock_quantity, state,
      featured, published, published_at, sold_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      "legacy-product",
      "JGC-LEGACY",
      "legacy-product",
      "Legacy Jeans",
      "Created before the family catalogue migration.",
      1_500_000,
      "new",
      "cat_jeans",
      JSON.stringify(["M"]),
      JSON.stringify(["denim"]),
      1,
      "available",
      0,
      1,
      timestamp,
      null,
      timestamp,
      timestamp,
    )
    .run();

  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(1));

  const productAudience = await env.DB.prepare(
    "SELECT audience FROM product_audiences WHERE product_id = ?",
  )
    .bind("legacy-product")
    .first<{ audience: string }>();
  const jeans = await env.DB.prepare(
    "SELECT audience FROM category_audiences WHERE category_id = 'cat_jeans' ORDER BY audience",
  ).all<{ audience: string }>();

  expect(productAudience?.audience).toBe("women");
  expect(jeans.results.map((row) => row.audience)).toEqual(["kids", "men", "women"]);
});
