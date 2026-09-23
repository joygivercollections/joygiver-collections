import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cartValidationSchema } from "../../shared/validation";
import {
  adminRequest,
  apiRequest,
  createProduct,
  resetStore,
  seedAdminSession,
  validProductInput,
} from "./helpers";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await resetStore();
  await seedAdminSession();
});

describe("admin product management", () => {
  it("requires an owner session for inventory access", async () => {
    const response = await apiRequest("/api/admin/products");
    expect(response.status).toBe(401);
  });

  it("creates a product with generated identity and first publication time", async () => {
    const product = await createProduct();

    expect(product.reference).toMatch(/^JGC-[A-F0-9]{8}$/);
    expect(product.slug).toBe("ivory-two-piece-set");
    expect(product.publishedAt).toMatch(/^20\d\d-/);
  });

  it("marks a product sold and restores it without losing inventory metadata", async () => {
    const product = await createProduct();
    const soldResponse = await adminRequest(
      `/api/admin/products/${product.id}/state`,
      {
        method: "PUT",
        body: JSON.stringify({ state: "sold" }),
      },
    );
    const sold = (await soldResponse.json()) as typeof product;
    const restoredResponse = await adminRequest(
      `/api/admin/products/${product.id}/state`,
      {
        method: "PUT",
        body: JSON.stringify({ state: "available" }),
      },
    );
    const restored = (await restoredResponse.json()) as typeof product;

    expect(soldResponse.status).toBe(200);
    expect(sold.state).toBe("sold");
    expect(sold.soldAt).toMatch(/^20\d\d-/);
    expect(restored.state).toBe("available");
    expect(restored.soldAt).toBeNull();
    expect(restored.name).toBe(sold.name);
  });

  it("requires the exact product reference before permanent deletion", async () => {
    const product = await createProduct();
    const rejected = await adminRequest(`/api/admin/products/${product.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmReference: "wrong-reference" }),
    });
    const accepted = await adminRequest(`/api/admin/products/${product.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmReference: product.reference }),
    });

    expect(rejected.status).toBe(409);
    expect(accepted.status).toBe(204);
  });

  it("refuses to retire a category while products still use it", async () => {
    await createProduct();
    const response = await adminRequest(
      "/api/admin/categories/cat_two_piece_sets",
      { method: "DELETE" },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ productCount: 1 });
  });

  it("rejects an incompatible audience update without partially changing the product", async () => {
    const product = await createProduct({
      name: "Ivory Mini Skirt",
      categoryId: "cat_mini_skirts",
      audiences: ["women"],
    });

    const response = await adminRequest(`/api/admin/products/${product.id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...validProductInput,
        name: "Changed name",
        categoryId: "cat_mini_skirts",
        audiences: ["men"],
        reference: product.reference,
      }),
    });
    const unchangedResponse = await adminRequest(`/api/admin/products/${product.id}`);
    const unchanged = (await unchangedResponse.json()) as {
      name: string;
      category: { id: string };
      audiences: string[];
    };

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "clothing_type_audience_conflict",
    });
    expect(unchanged).toMatchObject({
      name: "Ivory Mini Skirt",
      category: { id: "cat_mini_skirts" },
      audiences: ["women"],
    });
  });
});

describe("cart validation", () => {
  it("requires the customer's last-known price for change detection", () => {
    const result = cartValidationSchema.safeParse({
      items: [{ productId: "product-1", size: "M", quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("revalidates price and excludes sold, hidden, and deleted cart lines", async () => {
    const available = await createProduct({
      name: "Available Gown",
      categoryId: "cat_gowns",
      priceKobo: 2_000_000,
    });
    const sold = await createProduct({
      name: "Sold Gown",
      categoryId: "cat_gowns",
    });
    const hidden = await createProduct({
      name: "Hidden Gown",
      categoryId: "cat_gowns",
    });
    await adminRequest(`/api/admin/products/${sold.id}/state`, {
      method: "PUT",
      body: JSON.stringify({ state: "sold" }),
    });
    await adminRequest(`/api/admin/products/${hidden.id}/state`, {
      method: "PUT",
      body: JSON.stringify({ state: "hidden" }),
    });

    const response = await apiRequest("/api/cart/validate", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { productId: available.id, size: "M", quantity: 1, lastKnownPriceKobo: 1_900_000 },
          { productId: sold.id, size: "M", quantity: 1, lastKnownPriceKobo: sold.priceKobo },
          { productId: hidden.id, size: "M", quantity: 1, lastKnownPriceKobo: hidden.priceKobo },
          { productId: "deleted-product", size: "M", quantity: 1, lastKnownPriceKobo: 1_000_000 },
        ],
      }),
    });
    const result = (await response.json()) as {
      valid: Array<{ productId: string; priceChanged: boolean }>;
      invalid: Array<{ reason: string }>;
    };

    expect(response.status).toBe(200);
    expect(result.valid.map((line) => line.productId)).toEqual([available.id]);
    expect(result.invalid.map((line) => line.reason).sort()).toEqual([
      "deleted",
      "hidden",
      "sold",
    ]);
    expect(result.valid[0].priceChanged).toBe(true);
  });
});
