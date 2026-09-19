import { describe, expect, it } from "vitest";
import {
  cartValidationSchema,
  loginSchema,
  productInputSchema,
} from "../../shared/validation";

describe("productInputSchema", () => {
  it("accepts a valid new product", () => {
    const parsed = productInputSchema.parse({
      name: "Ivory Two-piece Set",
      description: "Soft structured set",
      priceKobo: 2_850_000,
      condition: "new",
      categoryId: "cat_sets",
      sizes: ["M", "L"],
      tags: ["office wear"],
      stockQuantity: 2,
      featured: true,
      published: true,
    });

    expect(parsed.condition).toBe("new");
    expect(parsed.sizes).toEqual(["M", "L"]);
  });

  it("rejects thrifted stock greater than one", () => {
    expect(() =>
      productInputSchema.parse({
        name: "Vintage Gown",
        description: "One available piece",
        priceKobo: 1_500_000,
        condition: "thrifted",
        categoryId: "cat_gowns",
        sizes: ["M"],
        tags: [],
        stockQuantity: 2,
        featured: false,
        published: true,
      }),
    ).toThrow(/thrifted/i);
  });

  it("rejects duplicate and empty sizes", () => {
    const result = productInputSchema.safeParse({
      name: "Champagne Gown",
      description: "Floor length gown",
      priceKobo: 2_100_000,
      condition: "new",
      categoryId: "cat_gowns",
      sizes: ["M", "M", ""],
      tags: [],
      stockQuantity: 1,
      featured: false,
      published: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("cartValidationSchema", () => {
  it("requires at least one selected line", () => {
    expect(() => cartValidationSchema.parse({ items: [] })).toThrow();
  });

  it("rejects more than fifty selected lines", () => {
    const items = Array.from({ length: 51 }, (_, index) => ({
      productId: `product-${index}`,
      size: "M",
      quantity: 1,
    }));

    expect(() => cartValidationSchema.parse({ items })).toThrow(/50/);
  });
});

describe("loginSchema", () => {
  it("normalizes owner email and requires a password", () => {
    const parsed = loginSchema.parse({
      email: "  OWNER@JOYGIverCollections.com ",
      password: "Owner passphrase 2026!",
    });

    expect(parsed.email).toBe("owner@joygivercollections.com");
  });
});
