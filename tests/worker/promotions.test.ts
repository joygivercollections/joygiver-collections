import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getActivePromotion } from "../../worker/db/promotions";
import { adminRequest, apiRequest, createProduct, createWholesalePackage, resetStore, seedAdminSession } from "./helpers";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => { await resetStore(); await seedAdminSession(); });

function promotionInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Six-piece edit",
    description: "Buy complete groups and save.",
    requiredQuantity: 6,
    discountBasisPoints: 1500,
    startAt: "2026-09-21T10:00:00.000Z",
    endAt: "2026-09-30T10:00:00.000Z",
    paused: false,
    productIds: [],
    wholesalePackageIds: [],
    ...overrides,
  };
}

async function createPromotion(overrides: Record<string, unknown> = {}) {
  return adminRequest("/api/admin/promotions", { method: "POST", body: JSON.stringify(promotionInput(overrides)) });
}

describe("scheduled promotions", () => {
  it("uses inclusive start and exclusive end schedule boundaries", async () => {
    expect((await createPromotion()).status).toBe(201);
    expect(await getActivePromotion(env.DB, new Date("2026-09-21T09:59:59.999Z"))).toBeNull();
    expect(await getActivePromotion(env.DB, new Date("2026-09-21T10:00:00.000Z"))).toMatchObject({ name: "Six-piece edit" });
    expect(await getActivePromotion(env.DB, new Date("2026-09-30T09:59:59.999Z"))).not.toBeNull();
    expect(await getActivePromotion(env.DB, new Date("2026-09-30T10:00:00.000Z"))).toBeNull();
  });

  it("rejects overlapping active schedules but permits paused overlap", async () => {
    expect((await createPromotion()).status).toBe(201);
    const overlap = await createPromotion({ name: "Overlap", startAt: "2026-09-25T00:00:00.000Z", endAt: "2026-10-01T00:00:00.000Z" });
    const paused = await createPromotion({ name: "Paused overlap", startAt: "2026-09-25T00:00:00.000Z", endAt: "2026-10-01T00:00:00.000Z", paused: true });
    expect(overlap.status).toBe(409);
    await expect(overlap.json()).resolves.toMatchObject({ code: "promotion_schedule_overlap" });
    expect(paused.status).toBe(201);
  });

  it("returns only the active public summary and marks eligible retail and wholesale", async () => {
    const product = await createProduct();
    const wholesale = await createWholesalePackage();
    const now = new Date();
    const response = await createPromotion({
      startAt: new Date(now.getTime() - 60_000).toISOString(), endAt: new Date(now.getTime() + 60_000).toISOString(),
      productIds: [product.id], wholesalePackageIds: [wholesale.id],
    });
    expect(response.status).toBe(201);

    const summary = await apiRequest("/api/promotion");
    const products = await apiRequest("/api/products");
    const packages = await apiRequest("/api/wholesale");
    expect(await summary.json()).toMatchObject({ name: "Six-piece edit", requiredQuantity: 6, discountBasisPoints: 1500 });
    expect((await products.json() as { items: Array<{ promoEligible?: boolean }> }).items[0].promoEligible).toBe(true);
    expect((await packages.json() as { items: Array<{ promoEligible?: boolean }> }).items[0].promoEligible).toBe(true);
  });
});
