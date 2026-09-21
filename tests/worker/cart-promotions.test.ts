import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { adminRequest, apiRequest, createProduct, createWholesalePackage, resetStore, seedAdminSession } from "./helpers";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => { await resetStore(); await seedAdminSession(); });

async function activePromotion(productId: string, packageId: string) {
  const now = Date.now();
  return adminRequest("/api/admin/promotions", { method: "POST", body: JSON.stringify({
    name: "Complete six", description: "", requiredQuantity: 6, discountBasisPoints: 1500,
    startAt: new Date(now - 60_000).toISOString(), endAt: new Date(now + 60_000).toISOString(), paused: false,
    productIds: [productId], wholesalePackageIds: [packageId],
  }) });
}

it("counts wholesale packages as cart units rather than internal pieces", async () => {
  const product = await createProduct({ stockQuantity: 10, priceKobo: 10_000 });
  const pkg = await createWholesalePackage({ pieceCount: 50, stockQuantity: 5, priceKobo: 20_000 });
  expect((await activePromotion(product.id, pkg.id)).status).toBe(201);

  const response = await apiRequest("/api/cart/validate", { method: "POST", body: JSON.stringify({ items: [
    { itemType: "retail", productId: product.id, size: "M", quantity: 5, lastKnownPriceKobo: 9_000 },
    { itemType: "wholesale", packageId: pkg.id, quantity: 1, lastKnownPriceKobo: 20_000 },
  ] }) });
  const result = await response.json() as { promotion: { eligibleQuantity: number; discountedQuantity: number }; regularSubtotalKobo: number; finalSubtotalKobo: number };
  expect(result.promotion).toMatchObject({ eligibleQuantity: 6, discountedQuantity: 6 });
  expect(result.finalSubtotalKobo).toBeLessThan(result.regularSubtotalKobo);

  const twoPackages = await apiRequest("/api/cart/validate", { method: "POST", body: JSON.stringify({ items: [
    { itemType: "retail", productId: product.id, size: "M", quantity: 5, lastKnownPriceKobo: 10_000 },
    { itemType: "wholesale", packageId: pkg.id, quantity: 2, lastKnownPriceKobo: 20_000 },
  ] }) });
  await expect(twoPackages.json()).resolves.toMatchObject({ promotion: { eligibleQuantity: 7, discountedQuantity: 6 } });
});

it("reconciles package quantity and price while excluding unavailable lines", async () => {
  const pkg = await createWholesalePackage({ stockQuantity: 2, priceKobo: 50_000 });
  const hidden = await createWholesalePackage({ name: "Hidden bale" });
  await adminRequest(`/api/admin/wholesale/${hidden.id}/state`, { method: "PUT", body: JSON.stringify({ state: "hidden" }) });
  const response = await apiRequest("/api/cart/validate", { method: "POST", body: JSON.stringify({ items: [
    { itemType: "wholesale", packageId: pkg.id, quantity: 5, lastKnownPriceKobo: 45_000 },
    { itemType: "wholesale", packageId: hidden.id, quantity: 1, lastKnownPriceKobo: 1 },
    { itemType: "wholesale", packageId: "deleted", quantity: 1, lastKnownPriceKobo: 1 },
  ] }) });
  const body = await response.json() as { valid: Array<{ quantity: number; priceChanged: boolean }>; invalid: Array<{ reason: string }> };
  expect(body.valid[0]).toMatchObject({ quantity: 2, priceChanged: true });
  expect(body.invalid.map((line) => line.reason).sort()).toEqual(["deleted", "hidden", "quantity_reduced"]);
});
