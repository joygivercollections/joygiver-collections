import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { storeProductImage } from "../../worker/db/products";
import {
  adminRequest,
  apiRequest,
  createProduct,
  resetStore,
  seedAdminSession,
} from "./helpers";

function jpegFile(name = "product.jpg") {
  return new File(
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])],
    name,
    { type: "image/jpeg" },
  );
}

async function imageCount() {
  return (
    (await env.DB.prepare("SELECT COUNT(*) AS total FROM product_images").first<number>(
      "total",
    )) ?? 0
  );
}

async function uploadImage(productId: string, file: File) {
  const form = new FormData();
  form.append("images", file);
  return adminRequest(`/api/admin/products/${productId}/images`, {
    method: "POST",
    body: form,
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await resetStore();
  await seedAdminSession();
});

describe("product image integrity", () => {
  it.each([
    ["image/gif", 1_024, 415],
    ["image/jpeg", 8 * 1_024 * 1_024 + 1, 413],
  ])("rejects invalid upload %s of %d bytes", async (type, size, status) => {
    const product = await createProduct();
    const response = await uploadImage(
      product.id,
      new File([new Uint8Array(size)], "photo.jpg", { type }),
    );

    expect(response.status).toBe(status);
    expect(await imageCount()).toBe(0);
  });

  it("stores a verified image and streams only its registered media key", async () => {
    const product = await createProduct();
    const uploaded = await uploadImage(product.id, jpegFile());
    const body = (await uploaded.json()) as {
      images: Array<{ id: string; url: string }>;
    };

    expect(uploaded.status).toBe(201);
    expect(body.images).toHaveLength(1);
    const media = await apiRequest(body.images[0].url);
    expect(media.status).toBe(200);
    expect(media.headers.get("Content-Type")).toBe("image/jpeg");
    expect(media.headers.get("Cache-Control")).toContain("immutable");
    expect((await media.arrayBuffer()).byteLength).toBe(8);
    expect((await apiRequest("/media/products/unregistered/file.jpg")).status).toBe(404);
  });

  it("does not insert image metadata when R2 put fails", async () => {
    const product = await createProduct();
    const failingBucket = {
      put: async () => {
        throw new Error("R2 unavailable");
      },
    } as unknown as R2Bucket;

    await expect(
      storeProductImage(env.DB, failingBucket, product.id, jpegFile()),
    ).rejects.toMatchObject({ code: "image_storage_unavailable" });
    expect(await imageCount()).toBe(0);
  });
});
