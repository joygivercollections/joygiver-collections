import { Hono } from "hono";
import { z } from "zod";
import { audienceSchema, cartValidationSchema } from "../../shared/validation";
import { listActiveCategories } from "../db/categories";
import { getPublicProduct, listPublicProducts, validateCart } from "../db/products";
import { getPublicWholesalePackage, listPublicWholesale } from "../db/wholesale";
import { getPublicPromotion } from "../db/promotions";
import { getSiteSettings } from "../db/site-settings";

interface PublicBindings {
  DB: D1Database;
  WHATSAPP_NUMBER: string;
}

const optionalTrimmed = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(120).optional(),
);

const catalogueQuerySchema = z
  .object({
    condition: z.enum(["new", "thrifted"]).optional(),
    audience: audienceSchema.optional(),
    category: optionalTrimmed,
    size: optionalTrimmed,
    minPriceKobo: z.coerce.number().int().min(0).optional(),
    maxPriceKobo: z.coerce.number().int().min(0).optional(),
    search: optionalTrimmed,
    sort: z.enum(["latest", "price-asc", "price-desc"]).default("latest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(24).default(24),
  })
  .superRefine((value, context) => {
    if (
      value.minPriceKobo !== undefined &&
      value.maxPriceKobo !== undefined &&
      value.minPriceKobo > value.maxPriceKobo
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxPriceKobo"],
        message: "Maximum price must be greater than or equal to minimum price",
      });
    }
  });

const wholesaleQuerySchema = z.object({
  audience: audienceSchema.optional(),
  condition: z.enum(["new", "thrifted", "mixed"]).optional(),
  category: optionalTrimmed,
  minPieceCount: z.coerce.number().int().min(1).optional(),
  maxPieceCount: z.coerce.number().int().min(1).optional(),
  minPriceKobo: z.coerce.number().int().min(0).optional(),
  maxPriceKobo: z.coerce.number().int().min(0).optional(),
  availability: z.enum(["available", "sold"]).optional(),
  search: optionalTrimmed,
  sort: z.enum(["latest", "price-asc", "price-desc"]).default("latest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(24),
}).superRefine((value, context) => {
  if (value.minPieceCount !== undefined && value.maxPieceCount !== undefined && value.minPieceCount > value.maxPieceCount) context.addIssue({ code: "custom", path: ["maxPieceCount"], message: "Maximum piece count must be at least the minimum" });
  if (value.minPriceKobo !== undefined && value.maxPriceKobo !== undefined && value.minPriceKobo > value.maxPriceKobo) context.addIssue({ code: "custom", path: ["maxPriceKobo"], message: "Maximum price must be at least the minimum" });
});

export const publicRoutes = new Hono<{ Bindings: PublicBindings }>();

publicRoutes.get("/config", (context) =>
  context.json({
    whatsAppNumber: (context.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, ""),
  }),
);

publicRoutes.get("/promotion", async (context) => context.json(await getPublicPromotion(context.env.DB, new Date())));
publicRoutes.get("/settings", async (context) => context.json(await getSiteSettings(context.env.DB)));

publicRoutes.get("/categories", async (context) => {
  const rawAudience = context.req.query("audience");
  const audience = rawAudience === undefined
    ? undefined
    : audienceSchema.safeParse(rawAudience);
  if (audience && !audience.success) {
    return context.json(
      { status: 400, code: "invalid_audience", message: "Audience must be Women, Men, or Kids" },
      400,
    );
  }
  return context.json(
    await listActiveCategories(context.env.DB, audience?.data),
  );
});

publicRoutes.get("/products", async (context) => {
  const rawAudience = context.req.query("audience");
  if (rawAudience !== undefined && !audienceSchema.safeParse(rawAudience).success) {
    return context.json(
      { status: 400, code: "invalid_audience", message: "Audience must be Women, Men, or Kids" },
      400,
    );
  }
  const parsed = catalogueQuerySchema.safeParse(context.req.query());
  if (!parsed.success) {
    return context.json(
      {
        status: 400,
        code: "invalid_catalogue_filters",
        message: "One or more catalogue filters are invalid",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  return context.json(
    await listPublicProducts(context.env.DB, parsed.data, new Date()),
  );
});

publicRoutes.get("/products/:slug", async (context) => {
  const slug = context.req.param("slug").trim();
  if (!slug || slug.length > 160) {
    return context.json(
      {
        status: 400,
        code: "invalid_product_slug",
        message: "Product address is invalid",
      },
      400,
    );
  }

  const product = await getPublicProduct(context.env.DB, slug, new Date());
  if (!product) {
    return context.json(
      {
        status: 404,
        code: "product_not_found",
        message: "This product is no longer available",
      },
      404,
    );
  }

  return context.json(product);
});

publicRoutes.get("/wholesale", async (context) => {
  const parsed = wholesaleQuerySchema.safeParse(context.req.query());
  if (!parsed.success) {
    return context.json({ status: 400, code: "invalid_wholesale_filters", message: "One or more wholesale filters are invalid", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  }
  return context.json(await listPublicWholesale(context.env.DB, parsed.data, new Date()));
});

publicRoutes.get("/wholesale/:slug", async (context) => {
  const slug = context.req.param("slug").trim();
  if (!slug || slug.length > 160) return context.json({ status: 400, code: "invalid_wholesale_slug", message: "Wholesale package address is invalid" }, 400);
  const item = await getPublicWholesalePackage(context.env.DB, slug, new Date());
  return item ? context.json(item) : context.json({ status: 404, code: "wholesale_not_found", message: "This wholesale package is no longer available" }, 404);
});

publicRoutes.post("/cart/validate", async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    body = null;
  }
  const parsed = cartValidationSchema.safeParse(body);
  if (!parsed.success) {
    return context.json(
      {
        status: 400,
        code: "invalid_cart",
        message: "Selected cart items are invalid",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }
  return context.json(await validateCart(context.env.DB, parsed.data.items));
});
