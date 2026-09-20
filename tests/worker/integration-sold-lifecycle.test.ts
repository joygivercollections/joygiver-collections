import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { getAdminProduct, listPublicProducts } from "../../worker/db/products";
import { createProduct, resetStore, seedAdminSession } from "./helpers";

beforeAll(async () => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
beforeEach(async () => {
  await resetStore();
  await seedAdminSession();
});

it("keeps a sold product public through 47:59:59, hides it at 48 hours, and retains it for the owner", async () => {
  const product = await createProduct();
  await env.DB.prepare("UPDATE products SET state = 'sold', sold_at = ? WHERE id = ?")
    .bind("2026-09-18T12:00:00.000Z", product.id)
    .run();

  const beforeBoundary = await listPublicProducts(env.DB, {}, new Date("2026-09-20T11:59:59.000Z"));
  const atBoundary = await listPublicProducts(env.DB, {}, new Date("2026-09-20T12:00:00.000Z"));

  expect(beforeBoundary.items.map((item) => item.id)).toContain(product.id);
  expect(beforeBoundary.items.find((item) => item.id === product.id)?.state).toBe("sold");
  expect(atBoundary.items.map((item) => item.id)).not.toContain(product.id);
  expect((await getAdminProduct(env.DB, product.id))?.state).toBe("sold");
});

it("adds browser security headers and prevents API responses from being cached", async () => {
  const response = await exports.default.fetch(new Request("https://joygivercollections.com/api/health"));
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
