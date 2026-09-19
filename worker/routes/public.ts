import { Hono } from "hono";
import { z } from "zod";
import { cartValidationSchema } from "../../shared/validation";
import { listActiveCategories } from "../db/categories";
import { getPublicProduct, listPublicProducts, validateCart } from "../db/products";

interface PublicBindings {
  DB: D1Database;
}

const optionalTrimmed = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(120).optional(),
);

const catalogueQuerySchema = z
  .object({
    condition: z.enum(["new", "thrifted"]).optional(),
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

export const publicRoutes = new Hono<{ Bindings: PublicBindings }>();

publicRoutes.get("/categories", async (context) => {
  return context.json(await listActiveCategories(context.env.DB));
});

publicRoutes.get("/products", async (context) => {
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
