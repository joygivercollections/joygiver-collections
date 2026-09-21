import { describe, expect, it } from "vitest";
import {
  cartValidationSchema,
  loginSchema,
  promotionInputSchema,
  productInputSchema,
  siteSettingsInputSchema,
  wholesalePackageInputSchema,
} from "../../shared/validation";

const audienceFields = {
  audiences: ["women"] as const,
  isUnisex: false,
};

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
      ...audienceFields,
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
        ...audienceFields,
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
      ...audienceFields,
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one audience", () => {
    const product = {
      name: "Ivory Two-piece Set",
      description: "Soft structured set",
      priceKobo: 2_850_000,
      condition: "new",
      categoryId: "cat_sets",
      sizes: ["M"],
      tags: [],
      stockQuantity: 1,
      featured: false,
      published: true,
      isUnisex: false,
    };

    expect(productInputSchema.safeParse({ ...product, audiences: [] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, audiences: ["women"] }).success).toBe(true);
  });
});

describe("wholesalePackageInputSchema", () => {
  it("accepts a mixed family package without exposing internal garments", () => {
    const parsed = wholesalePackageInputSchema.parse({
      name: "Family Denim Bale",
      description: "A mixed wholesale denim package.",
      audiences: ["women", "men", "kids"],
      conditionScope: "mixed",
      categoryIds: ["cat_jeans"],
      pieceCount: 24,
      priceKobo: 18_000_000,
      stockQuantity: 3,
      featured: true,
      published: false,
    });

    expect(parsed.pieceCount).toBe(24);
    expect(parsed).not.toHaveProperty("garments");
  });
});

describe("promotionInputSchema", () => {
  it("rejects an end time that is not later than the start time", () => {
    const parsed = promotionInputSchema.safeParse({
      name: "Six-piece edit",
      description: "",
      requiredQuantity: 6,
      discountBasisPoints: 1_500,
      startAt: "2026-10-01T09:00:00.000Z",
      endAt: "2026-10-01T08:59:59.000Z",
      paused: false,
      productIds: [],
      wholesalePackageIds: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("siteSettingsInputSchema", () => {
  it("trims bounded hero copy", () => {
    const parsed = siteSettingsInputSchema.parse({
      heroHeading: "  Style for every story.  ",
      heroCopy: "  New and thrifted fashion for Women, Men, and Kids.  ",
    });

    expect(parsed.heroHeading).toBe("Style for every story.");
    expect(parsed.heroCopy).toBe("New and thrifted fashion for Women, Men, and Kids.");
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
