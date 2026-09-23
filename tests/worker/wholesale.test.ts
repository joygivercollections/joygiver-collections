import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listPublicWholesale } from "../../worker/db/wholesale";
import { createWholesalePackage, resetStore, seedAdminSession } from "./helpers";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await resetStore();
  await seedAdminSession();
});

describe("public wholesale catalogue", () => {
  it("filters package metadata without exposing an internal garment list", async () => {
    await createWholesalePackage({ name: "Lady's 100% Denim Bale", audiences: ["women"], conditionScope: "mixed", pieceCount: 24, priceKobo: 18_000_000 });
    await createWholesalePackage({ name: "Men Shirts Bale", audiences: ["men"], conditionScope: "new", categoryIds: ["cat_shirts"], pieceCount: 12, priceKobo: 9_000_000 });

    const response = await exports.default.fetch(new Request(
      "https://joygivercollections.com/api/wholesale?audience=women&condition=mixed&category=jeans&minPieceCount=20&maxPieceCount=30&minPriceKobo=17000000&maxPriceKobo=19000000&search=100%",
    ));
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: "Lady's 100% Denim Bale", pieceCount: 24, priceKobo: 18_000_000 });
    expect(body.items[0]).not.toHaveProperty("items");
    expect(body.items[0]).not.toHaveProperty("garments");
  });

  it("keeps sold packages public before 48 hours and excludes them at the exact boundary", async () => {
    const recent = await createWholesalePackage({ name: "Recent Sold Bale" });
    const boundary = await createWholesalePackage({ name: "Boundary Sold Bale" });
    await env.DB.batch([
      env.DB.prepare("UPDATE wholesale_packages SET state = 'sold', sold_at = ? WHERE id = ?").bind("2026-09-18T12:00:01.000Z", recent.id),
      env.DB.prepare("UPDATE wholesale_packages SET state = 'sold', sold_at = ? WHERE id = ?").bind("2026-09-18T12:00:00.000Z", boundary.id),
    ]);

    const result = await listPublicWholesale(env.DB, {}, new Date("2026-09-20T12:00:00.000Z"));
    expect(result.items.map((item) => item.id)).toContain(recent.id);
    expect(result.items.map((item) => item.id)).not.toContain(boundary.id);
  });

  it("returns package detail and rejects unknown public filters", async () => {
    const created = await createWholesalePackage();
    const detail = await exports.default.fetch(new Request(`https://joygivercollections.com/api/wholesale/${created.slug}`));
    const invalid = await exports.default.fetch(new Request("https://joygivercollections.com/api/wholesale?audience=adult"));

    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ id: created.id, pieceCount: 24 });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ code: "invalid_wholesale_filters" });
  });
});
