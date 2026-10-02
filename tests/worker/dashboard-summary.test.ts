import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { adminRequest, createProduct, createWholesalePackage, resetStore, seedAdminSession } from "./helpers";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => { await resetStore(); await seedAdminSession(); });

it("summarises retail audiences, available wholesale, and the current or next promotion", async () => {
  await createProduct({ name: "Women's Gown", audiences: ["women"] });
  await createProduct({ name: "Men's Shirt", categoryId: "cat_shirts", audiences: ["men"] });
  await createProduct({ name: "Kids Set", categoryId: "cat_two_piece_sets", audiences: ["kids"] });
  const availablePackage = await createWholesalePackage();
  const soldPackage = await createWholesalePackage({ name: "Sold Denim Bale" });
  await adminRequest(`/api/admin/wholesale/${soldPackage.id}/state`, { method: "PUT", body: JSON.stringify({ state: "sold" }) });
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  await adminRequest("/api/admin/promotions", { method: "POST", body: JSON.stringify({ name: "Family bundle", description: "Complete groups save.", requiredQuantity: 6, discountBasisPoints: 1200, startAt: start.toISOString(), endAt: end.toISOString(), paused: false, productIds: [], wholesalePackageIds: [availablePackage.id] }) });

  const response = await adminRequest("/api/admin/summary");

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    total: 3,
    retailByAudience: { women: 1, men: 1, kids: 1 },
    availableWholesalePackages: 1,
    promotion: { name: "Family bundle", status: "scheduled" },
  });
});
