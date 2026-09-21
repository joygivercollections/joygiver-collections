import { z } from "zod";

export const audienceSchema = z.enum(["women", "men", "kids"]);

const audiencesSchema = z
  .array(audienceSchema)
  .min(1, "Choose at least one audience")
  .max(3)
  .superRefine((items, context) => {
    if (new Set(items).size !== items.length) {
      context.addIssue({ code: "custom", message: "Audiences must be unique" });
    }
  });

const uniqueTrimmedStrings = (minimum: number, maximum: number) =>
  z
    .array(z.string().trim().min(1).max(80))
    .min(minimum)
    .max(maximum)
    .superRefine((items, context) => {
      const normalized = items.map((item) => item.toLocaleLowerCase());
      if (new Set(normalized).size !== normalized.length) {
        context.addIssue({
          code: "custom",
          message: "Values must be unique",
        });
      }
    });

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(2_000),
    priceKobo: z.number().int().positive().safe(),
    condition: z.enum(["new", "thrifted"]),
    categoryId: z.string().trim().min(1).max(80),
    sizes: uniqueTrimmedStrings(1, 20),
    tags: uniqueTrimmedStrings(0, 20),
    stockQuantity: z.number().int().min(0).max(999),
    featured: z.boolean(),
    published: z.boolean(),
    audiences: audiencesSchema,
    isUnisex: z.boolean(),
    reference: z.string().trim().min(3).max(40).optional(),
  })
  .superRefine((value, context) => {
    if (value.condition === "thrifted" && value.stockQuantity > 1) {
      context.addIssue({
        code: "custom",
        path: ["stockQuantity"],
        message: "Thrifted products can have at most one item in stock",
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const wholesalePackageInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(2_000),
  audiences: audiencesSchema,
  conditionScope: z.enum(["new", "thrifted", "mixed"]),
  categoryIds: uniqueTrimmedStrings(1, 30),
  pieceCount: z.number().int().min(1).max(10_000),
  priceKobo: z.number().int().positive().safe(),
  stockQuantity: z.number().int().min(0).max(999),
  featured: z.boolean(),
  published: z.boolean(),
  reference: z.string().trim().min(3).max(40).optional(),
});

export type WholesalePackageInput = z.infer<typeof wholesalePackageInputSchema>;

export const promotionInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500),
    requiredQuantity: z.number().int().min(2).max(100),
    discountBasisPoints: z.number().int().min(1).max(9_900),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    paused: z.boolean(),
    productIds: uniqueTrimmedStrings(0, 500),
    wholesalePackageIds: uniqueTrimmedStrings(0, 500),
  })
  .refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
    path: ["endAt"],
    message: "End time must be later than start time",
  });

export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const siteSettingsInputSchema = z.object({
  heroHeading: z.string().trim().min(2).max(120),
  heroCopy: z.string().trim().min(2).max(500),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsInputSchema>;

const retailCartValidationLineSchema = z.object({
  itemType: z.literal("retail").optional(),
  productId: z.string().trim().min(1).max(80),
  size: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(999),
  lastKnownPriceKobo: z.number().int().positive().safe(),
});

const wholesaleCartValidationLineSchema = z.object({
  itemType: z.literal("wholesale"),
  packageId: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(999),
  lastKnownPriceKobo: z.number().int().positive().safe(),
});

export const cartValidationSchema = z.object({
  items: z
    .array(z.union([wholesaleCartValidationLineSchema, retailCartValidationLineSchema]))
    .min(1, "Select at least one item")
    .max(50, "A maximum of 50 items can be checked at once"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1_024),
});
