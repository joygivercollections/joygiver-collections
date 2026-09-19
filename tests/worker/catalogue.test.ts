import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listPublicProducts } from "../../worker/db/products";

interface SeedProduct {
  id: string;
  name?: string;
  state?: "available" | "sold" | "hidden";
  soldAt?: string | null;
  publishedAt?: string;
  condition?: "new" | "thrifted";
}

async function clearProducts() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM product_images"),
    env.DB.prepare("DELETE FROM products"),
  ]);
}

async function seedProduct({
  id,
  name = `Product ${id}`,
  state = "available",
  soldAt = null,
  publishedAt = "2026-09-19T10:00:00.000Z",
  condition = "new",
}: SeedProduct) {
  const category = await env.DB.prepare(
    "SELECT id FROM categories WHERE slug = 'gowns' LIMIT 1",
  ).first<{ id: string }>();

  if (!category) throw new Error("Seed category was not migrated");

  await env.DB.prepare(
    `INSERT INTO products (
      id, reference, slug, name, description, price_kobo, condition,
      category_id, sizes_json, tags_json, stock_quantity, state,
      featured, published, published_at, sold_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      `JGC-${id.toUpperCase()}`,
      `product-${id}`,
      name,
      `${name} description`,
      1_500_000,
      condition,
      category.id,
      JSON.stringify(["M"]),
      JSON.stringify(["gown"]),
      1,
      state,
      publishedAt,
      soldAt,
      publishedAt,
      publishedAt,
    )
    .run();
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await clearProducts();
});

describe("listPublicProducts", () => {
  it("keeps sold products public before 48 hours and excludes them at the boundary", async () => {
    await seedProduct({
      id: "recent",
      state: "sold",
      soldAt: "2026-09-18T12:00:01.000Z",
    });
    await seedProduct({
      id: "boundary",
      state: "sold",
      soldAt: "2026-09-18T12:00:00.000Z",
    });

    const result = await listPublicProducts(
      env.DB,
      {},
      new Date("2026-09-20T12:00:00.000Z"),
    );

    expect(result.items.map((item) => item.id)).toContain("recent");
    expect(result.items.map((item) => item.id)).not.toContain("boundary");
  });

  it("treats punctuation and wildcard characters as literal search text", async () => {
    await seedProduct({ id: "quoted", name: "Lady's 100% Cotton Gown" });
    await seedProduct({ id: "distractor", name: "Lady's Cotton Gown" });

    const result = await listPublicProducts(
      env.DB,
      { search: "Lady's 100%" },
      new Date("2026-09-20T12:00:00.000Z"),
    );

    expect(result.items.map((item) => item.id)).toEqual(["quoted"]);
  });

  it("returns latest published products first and caps a home request at eight", async () => {
    for (let index = 0; index < 10; index += 1) {
      await seedProduct({
        id: `latest-${index}`,
        publishedAt: `2026-09-19T${String(index).padStart(2, "0")}:00:00.000Z`,
      });
    }

    const result = await listPublicProducts(
      env.DB,
      { sort: "latest", limit: 8 },
      new Date("2026-09-20T12:00:00.000Z"),
    );

    expect(result.items).toHaveLength(8);
    expect(result.items[0].id).toBe("latest-9");
    expect(result.items[7].id).toBe("latest-2");
  });
});

describe("public catalogue routes", () => {
  it("returns the eight active categories", async () => {
    const response = await exports.default.fetch(
      new Request("https://joygivercollections.com/api/categories"),
    );

    expect(response.status).toBe(200);
    const categories = (await response.json()) as Array<{ slug: string }>;
    expect(categories).toHaveLength(8);
    expect(categories.map((category) => category.slug)).toContain("gowns");
  });

  it("rejects an unsupported condition and oversized page", async () => {
    const invalidCondition = await exports.default.fetch(
      new Request("https://joygivercollections.com/api/products?condition=used"),
    );
    const oversizedPage = await exports.default.fetch(
      new Request("https://joygivercollections.com/api/products?limit=25"),
    );

    expect(invalidCondition.status).toBe(400);
    expect(oversizedPage.status).toBe(400);
  });

  it("filters the public API by condition", async () => {
    await seedProduct({ id: "new-gown", condition: "new" });
    await seedProduct({ id: "thrift-gown", condition: "thrifted" });

    const response = await exports.default.fetch(
      new Request(
        "https://joygivercollections.com/api/products?condition=thrifted",
      ),
    );
    const body = (await response.json()) as { items: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.id)).toEqual(["thrift-gown"]);
  });
});
