import { z } from "zod";

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

const cartValidationLineSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  size: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(999),
});

export const cartValidationSchema = z.object({
  items: z
    .array(cartValidationLineSchema)
    .min(1, "Select at least one item")
    .max(50, "A maximum of 50 items can be checked at once"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1_024),
});
