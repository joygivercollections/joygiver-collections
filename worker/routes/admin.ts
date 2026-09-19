import { Hono } from "hono";
import { z } from "zod";
import { productInputSchema } from "../../shared/validation";
import {
  createCategory,
  listAllCategories,
  retireCategory,
  updateCategory,
} from "../db/categories";
import {
  changeProductState,
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
});
const imageOrderSchema = z.object({
  imageIds: z.array(z.string().uuid()).max(6),
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
  const category = await updateCategory(context.env.DB, context.req.param("id"), parsed.data);
  return category
    ? context.json(category)
    : context.json(
        { status: 404, code: "category_not_found", message: "Category was not found" },
        404,
      );
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
