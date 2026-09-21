import { Hono } from "hono";
import { z } from "zod";
import { audienceSchema, productInputSchema, promotionInputSchema, wholesalePackageInputSchema } from "../../shared/validation";
import {
  CategoryAudienceConflictError,
  createCategory,
  listAllCategories,
  retireCategory,
  updateCategory,
} from "../db/categories";
import {
  changeProductState,
  ClothingTypeAudienceError,
  createAdminProduct,
  deleteAdminProduct,
  deleteProductImage,
  getAdminProduct,
  getInventorySummary,
  listAdminProducts,
  ProductImageError,
  reorderProductImages,
  storeProductImage,
  updateAdminProduct,
} from "../db/products";
import {
  changeWholesaleState,
  createAdminWholesalePackage,
  deleteAdminWholesalePackage,
  deleteWholesaleImage,
  getAdminWholesalePackage,
  listAdminWholesalePackages,
  reorderWholesaleImages,
  storeWholesaleImage,
  updateAdminWholesalePackage,
  WholesaleTypeAudienceError,
} from "../db/wholesale";
import { ImageStorageError, validateImageFile } from "../lib/images";
import {
  createAdminPromotion,
  deleteAdminPromotion,
  getAdminPromotion,
  listAdminPromotions,
  PromotionScheduleOverlapError,
  updateAdminPromotion,
} from "../db/promotions";
import { requireSameOrigin } from "../lib/origin";
import { getAdminFromRequest } from "../lib/session";

interface AdminBindings {
  DB: D1Database;
  PRODUCT_IMAGES: R2Bucket;
}

interface AdminVariables {
  admin: { id: string; email: string };
}

export const adminRoutes = new Hono<{
  Bindings: AdminBindings;
  Variables: AdminVariables;
}>();

const adminListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  state: z.enum(["available", "sold", "hidden"]).optional(),
  condition: z.enum(["new", "thrifted"]).optional(),
  audience: audienceSchema.optional(),
  category: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
const stateSchema = z.object({ state: z.enum(["available", "sold", "hidden"]) });
const deleteSchema = z.object({ confirmReference: z.string().trim().min(1).max(40) });
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
  audiences: z.array(audienceSchema).min(1).max(3).default(["women"]),
});
const imageOrderSchema = z.object({
  imageIds: z.array(z.string().uuid()).max(6),
});
const wholesaleListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  state: z.enum(["available", "sold", "hidden"]).optional(),
  condition: z.enum(["new", "thrifted", "mixed"]).optional(),
  audience: audienceSchema.optional(),
  category: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function databaseConflict(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed|FOREIGN KEY constraint failed/i.test(error.message);
}

adminRoutes.use("*", async (context, next) => {
  if (!requireSameOrigin(context.req.raw)) {
    return context.json(
      { status: 403, code: "origin_forbidden", message: "Request origin is not allowed" },
      403,
    );
  }
  const admin = await getAdminFromRequest(context.env.DB, context.req.raw);
  if (!admin) {
    return context.json(
      { status: 401, code: "authentication_required", message: "Owner login is required" },
      401,
    );
  }
  context.set("admin", admin);
  await next();
});

adminRoutes.get("/summary", async (context) =>
  context.json(await getInventorySummary(context.env.DB)),
);

adminRoutes.get("/products", async (context) => {
  const parsed = adminListSchema.safeParse(context.req.query());
  if (!parsed.success) {
    return context.json(
      { status: 400, code: "invalid_inventory_filters", message: "Inventory filters are invalid" },
      400,
    );
  }
  return context.json(await listAdminProducts(context.env.DB, parsed.data));
});

adminRoutes.post("/products", async (context) => {
  const parsed = productInputSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      {
        status: 400,
        code: "invalid_product",
        message: "Product details are invalid",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }
  try {
    return context.json(await createAdminProduct(context.env.DB, parsed.data), 201);
  } catch (error) {
    if (error instanceof ClothingTypeAudienceError) {
      return context.json(
        { status: 409, code: "clothing_type_audience_conflict", message: error.message },
        409,
      );
    }
    if (databaseConflict(error)) {
      return context.json(
        { status: 409, code: "product_conflict", message: "Reference, category, or product address conflicts" },
        409,
      );
    }
    throw error;
  }
});

adminRoutes.get("/products/:id", async (context) => {
  const product = await getAdminProduct(context.env.DB, context.req.param("id"));
  return product
    ? context.json(product)
    : context.json(
        { status: 404, code: "product_not_found", message: "Product was not found" },
        404,
      );
});

adminRoutes.put("/products/:id", async (context) => {
  const parsed = productInputSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      {
        status: 400,
        code: "invalid_product",
        message: "Product details are invalid",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }
  try {
    const product = await updateAdminProduct(
      context.env.DB,
      context.req.param("id"),
      parsed.data,
    );
    return product
      ? context.json(product)
      : context.json(
          { status: 404, code: "product_not_found", message: "Product was not found" },
          404,
        );
  } catch (error) {
    if (error instanceof ClothingTypeAudienceError) {
      return context.json(
        { status: 409, code: "clothing_type_audience_conflict", message: error.message },
        409,
      );
    }
    if (databaseConflict(error)) {
      return context.json(
        { status: 409, code: "product_conflict", message: "Reference, category, or product address conflicts" },
        409,
      );
    }
    throw error;
  }
});

adminRoutes.put("/products/:id/state", async (context) => {
  const parsed = stateSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      { status: 400, code: "invalid_product_state", message: "Product state is invalid" },
      400,
    );
  }
  const product = await changeProductState(
    context.env.DB,
    context.req.param("id"),
    parsed.data.state,
  );
  return product
    ? context.json(product)
    : context.json(
        { status: 404, code: "product_not_found", message: "Product was not found" },
        404,
      );
});

adminRoutes.delete("/products/:id", async (context) => {
  const product = await getAdminProduct(context.env.DB, context.req.param("id"));
  if (!product) {
    return context.json(
      { status: 404, code: "product_not_found", message: "Product was not found" },
      404,
    );
  }
  const parsed = deleteSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success || parsed.data.confirmReference !== product.reference) {
    return context.json(
      { status: 409, code: "reference_confirmation_required", message: "Type the exact product reference to delete it" },
      409,
    );
  }
  const keys = await context.env.DB.prepare(
    "SELECT object_key FROM product_images WHERE product_id = ?",
  )
    .bind(product.id)
    .all<{ object_key: string }>();
  try {
    if (keys.results.length) {
      await context.env.PRODUCT_IMAGES.delete(keys.results.map((row) => row.object_key));
    }
  } catch {
    return context.json(
      { status: 503, code: "image_storage_unavailable", message: "Images could not be removed; try again" },
      503,
    );
  }
  await deleteAdminProduct(context.env.DB, product.id);
  return context.body(null, 204);
});

adminRoutes.post("/products/:id/images", async (context) => {
  const form = await context.req.formData();
  const files = form.getAll("images").filter((value): value is File => value instanceof File);
  if (files.length < 1 || files.length > 6) {
    return context.json(
      { status: 400, code: "invalid_image_count", message: "Upload between one and six images" },
      400,
    );
  }
  const images = [];
  try {
    for (const file of files) {
      images.push(
        await storeProductImage(
          context.env.DB,
          context.env.PRODUCT_IMAGES,
          context.req.param("id"),
          file,
          typeof form.get("altText") === "string" ? String(form.get("altText")) : undefined,
        ),
      );
    }
    return context.json({ images }, 201);
  } catch (error) {
    if (error instanceof ProductImageError) {
      return context.json(
        { status: error.status, code: error.code, message: error.message },
        error.status,
      );
    }
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return context.json(
        { status: 404, code: "product_not_found", message: "Product was not found" },
        404,
      );
    }
    throw error;
  }
});

adminRoutes.delete("/products/:productId/images/:imageId", async (context) => {
  try {
    const deleted = await deleteProductImage(
      context.env.DB,
      context.env.PRODUCT_IMAGES,
      context.req.param("productId"),
      context.req.param("imageId"),
    );
    return deleted
      ? context.body(null, 204)
      : context.json(
          { status: 404, code: "image_not_found", message: "Image was not found" },
          404,
        );
  } catch (error) {
    if (error instanceof ProductImageError) {
      return context.json(
        { status: error.status, code: error.code, message: error.message },
        error.status,
      );
    }
    throw error;
  }
});

adminRoutes.put("/products/:id/images/order", async (context) => {
  const parsed = imageOrderSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      { status: 400, code: "invalid_image_order", message: "Image order is invalid" },
      400,
    );
  }
  const images = await reorderProductImages(
    context.env.DB,
    context.req.param("id"),
    parsed.data.imageIds,
  );
  return images
    ? context.json({ images })
    : context.json(
        { status: 409, code: "image_order_conflict", message: "Image list changed; refresh and try again" },
        409,
      );
});

adminRoutes.get("/wholesale", async (context) => {
  const parsed = wholesaleListSchema.safeParse(context.req.query());
  if (!parsed.success) return context.json({ status: 400, code: "invalid_wholesale_filters", message: "Wholesale inventory filters are invalid" }, 400);
  return context.json(await listAdminWholesalePackages(context.env.DB, parsed.data));
});

adminRoutes.post("/wholesale", async (context) => {
  const parsed = wholesalePackageInputSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) return context.json({ status: 400, code: "invalid_wholesale_package", message: "Wholesale package details are invalid", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  try {
    return context.json(await createAdminWholesalePackage(context.env.DB, parsed.data), 201);
  } catch (error) {
    if (error instanceof WholesaleTypeAudienceError) return context.json({ status: 409, code: "clothing_type_audience_conflict", message: error.message }, 409);
    if (databaseConflict(error)) return context.json({ status: 409, code: "wholesale_conflict", message: "Reference, clothing type, or package address conflicts" }, 409);
    throw error;
  }
});

adminRoutes.get("/wholesale/:id", async (context) => {
  const item = await getAdminWholesalePackage(context.env.DB, context.req.param("id"));
  return item ? context.json(item) : context.json({ status: 404, code: "wholesale_not_found", message: "Wholesale package was not found" }, 404);
});

adminRoutes.put("/wholesale/:id", async (context) => {
  const parsed = wholesalePackageInputSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) return context.json({ status: 400, code: "invalid_wholesale_package", message: "Wholesale package details are invalid", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  try {
    const item = await updateAdminWholesalePackage(context.env.DB, context.req.param("id"), parsed.data);
    return item ? context.json(item) : context.json({ status: 404, code: "wholesale_not_found", message: "Wholesale package was not found" }, 404);
  } catch (error) {
    if (error instanceof WholesaleTypeAudienceError) return context.json({ status: 409, code: "clothing_type_audience_conflict", message: error.message }, 409);
    if (databaseConflict(error)) return context.json({ status: 409, code: "wholesale_conflict", message: "Reference, clothing type, or package address conflicts" }, 409);
    throw error;
  }
});

adminRoutes.put("/wholesale/:id/state", async (context) => {
  const parsed = stateSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) return context.json({ status: 400, code: "invalid_wholesale_state", message: "Wholesale package state is invalid" }, 400);
  const item = await changeWholesaleState(context.env.DB, context.req.param("id"), parsed.data.state);
  return item ? context.json(item) : context.json({ status: 404, code: "wholesale_not_found", message: "Wholesale package was not found" }, 404);
});

adminRoutes.delete("/wholesale/:id", async (context) => {
  const item = await getAdminWholesalePackage(context.env.DB, context.req.param("id"));
  if (!item) return context.json({ status: 404, code: "wholesale_not_found", message: "Wholesale package was not found" }, 404);
  const parsed = deleteSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success || parsed.data.confirmReference !== item.reference) return context.json({ status: 409, code: "reference_confirmation_required", message: "Type the exact wholesale reference to delete it" }, 409);
  const keys = await context.env.DB.prepare("SELECT object_key FROM wholesale_package_images WHERE package_id = ?").bind(item.id).all<{ object_key: string }>();
  try { if (keys.results.length) await context.env.PRODUCT_IMAGES.delete(keys.results.map((row) => row.object_key)); }
  catch { return context.json({ status: 503, code: "image_storage_unavailable", message: "Images could not be removed; try again" }, 503); }
  await deleteAdminWholesalePackage(context.env.DB, item.id);
  return context.body(null, 204);
});

adminRoutes.post("/wholesale/:id/images", async (context) => {
  const form = await context.req.formData();
  const files = form.getAll("images").filter((value): value is File => value instanceof File);
  if (files.length < 1 || files.length > 6) return context.json({ status: 400, code: "invalid_image_count", message: "Upload between one and six images" }, 400);
  for (const file of files) {
    try { await validateImageFile(file); }
    catch (error) {
      if (error instanceof ImageStorageError) return context.json({ status: error.status, code: error.code, message: `${file.name}: ${error.message}` }, error.status);
      throw error;
    }
  }
  const images = [];
  try {
    for (const file of files) images.push(await storeWholesaleImage(context.env.DB, context.env.PRODUCT_IMAGES, context.req.param("id"), file, typeof form.get("altText") === "string" ? String(form.get("altText")) : undefined));
    return context.json({ images }, 201);
  } catch (error) {
    if (error instanceof ImageStorageError) return context.json({ status: error.status, code: error.code, message: error.message }, error.status);
    if (error instanceof Error && error.message === "WHOLESALE_NOT_FOUND") return context.json({ status: 404, code: "wholesale_not_found", message: "Wholesale package was not found" }, 404);
    throw error;
  }
});

adminRoutes.delete("/wholesale/:packageId/images/:imageId", async (context) => {
  try {
    const deleted = await deleteWholesaleImage(context.env.DB, context.env.PRODUCT_IMAGES, context.req.param("packageId"), context.req.param("imageId"));
    return deleted ? context.body(null, 204) : context.json({ status: 404, code: "image_not_found", message: "Image was not found" }, 404);
  } catch (error) {
    if (error instanceof ImageStorageError) return context.json({ status: error.status, code: error.code, message: error.message }, error.status);
    throw error;
  }
});

adminRoutes.put("/wholesale/:id/images/order", async (context) => {
  const parsed = imageOrderSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) return context.json({ status: 400, code: "invalid_image_order", message: "Image order is invalid" }, 400);
  const images = await reorderWholesaleImages(context.env.DB, context.req.param("id"), parsed.data.imageIds);
  return images ? context.json({ images }) : context.json({ status: 409, code: "image_order_conflict", message: "Image list changed; refresh and try again" }, 409);
});

adminRoutes.get("/promotions", async (context) => context.json(await listAdminPromotions(context.env.DB)));

adminRoutes.post("/promotions", async (context) => {
  const parsed = promotionInputSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) return context.json({ status: 400, code: "invalid_promotion", message: "Promotion details are invalid", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  try { return context.json(await createAdminPromotion(context.env.DB, parsed.data), 201); }
  catch (error) {
    if (error instanceof PromotionScheduleOverlapError) return context.json({ status: 409, code: "promotion_schedule_overlap", message: error.message }, 409);
    if (databaseConflict(error)) return context.json({ status: 409, code: "promotion_conflict", message: "Promotion eligibility contains an unavailable item" }, 409);
    throw error;
  }
});

adminRoutes.get("/promotions/:id", async (context) => {
  const promotion = await getAdminPromotion(context.env.DB, context.req.param("id"));
  return promotion ? context.json(promotion) : context.json({ status: 404, code: "promotion_not_found", message: "Promotion was not found" }, 404);
});

adminRoutes.put("/promotions/:id", async (context) => {
  const parsed = promotionInputSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) return context.json({ status: 400, code: "invalid_promotion", message: "Promotion details are invalid", fieldErrors: parsed.error.flatten().fieldErrors }, 400);
  try {
    const promotion = await updateAdminPromotion(context.env.DB, context.req.param("id"), parsed.data);
    return promotion ? context.json(promotion) : context.json({ status: 404, code: "promotion_not_found", message: "Promotion was not found" }, 404);
  } catch (error) {
    if (error instanceof PromotionScheduleOverlapError) return context.json({ status: 409, code: "promotion_schedule_overlap", message: error.message }, 409);
    if (databaseConflict(error)) return context.json({ status: 409, code: "promotion_conflict", message: "Promotion eligibility contains an unavailable item" }, 409);
    throw error;
  }
});

adminRoutes.delete("/promotions/:id", async (context) => {
  const deleted = await deleteAdminPromotion(context.env.DB, context.req.param("id"));
  return deleted ? context.body(null, 204) : context.json({ status: 404, code: "promotion_not_found", message: "Promotion was not found" }, 404);
});

adminRoutes.get("/categories", async (context) =>
  context.json(await listAllCategories(context.env.DB)),
);

adminRoutes.post("/categories", async (context) => {
  const parsed = categorySchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      { status: 400, code: "invalid_category", message: "Category details are invalid" },
      400,
    );
  }
  try {
    return context.json(
      await createCategory(
        context.env.DB,
        parsed.data.name,
        parsed.data.displayOrder,
        parsed.data.audiences,
      ),
      201,
    );
  } catch (error) {
    if (databaseConflict(error)) {
      return context.json(
        { status: 409, code: "category_conflict", message: "A category with this name already exists" },
        409,
      );
    }
    throw error;
  }
});

adminRoutes.put("/categories/:id", async (context) => {
  const parsed = categorySchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      { status: 400, code: "invalid_category", message: "Category details are invalid" },
      400,
    );
  }
  try {
    const category = await updateCategory(context.env.DB, context.req.param("id"), parsed.data);
    return category
      ? context.json(category)
      : context.json(
          { status: 404, code: "category_not_found", message: "Category was not found" },
          404,
        );
  } catch (error) {
    if (error instanceof CategoryAudienceConflictError) {
      return context.json(
        {
          status: 409,
          code: "clothing_type_audience_conflict",
          message: error.message,
          productCount: error.productCount,
        },
        409,
      );
    }
    if (databaseConflict(error)) {
      return context.json(
        { status: 409, code: "category_conflict", message: "A clothing type with this name already exists" },
        409,
      );
    }
    throw error;
  }
});

adminRoutes.delete("/categories/:id", async (context) => {
  const result = await retireCategory(context.env.DB, context.req.param("id"));
  if (!result.found) {
    return context.json(
      { status: 404, code: "category_not_found", message: "Category was not found" },
      404,
    );
  }
  if (!result.retired) {
    return context.json(
      {
        status: 409,
        code: "category_in_use",
        message: "Reassign products before retiring this category",
        productCount: result.productCount,
      },
      409,
    );
  }
  return context.body(null, 204);
});
