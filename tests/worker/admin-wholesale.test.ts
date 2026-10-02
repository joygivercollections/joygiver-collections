import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../../worker/lib/session";
import { adminRequest, adminToken, apiRequest, createWholesalePackage, resetStore, seedAdminSession, storeOrigin } from "./helpers";

function jpegFile(name = "package.jpg") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])], name, { type: "image/jpeg" });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await resetStore();
  await seedAdminSession();
});

describe("admin wholesale management", () => {
  it("requires authentication and same-origin mutation requests", async () => {
    expect((await apiRequest("/api/admin/wholesale")).status).toBe(401);
    expect((await apiRequest("/api/admin/wholesale", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
      body: JSON.stringify({}),
    })).status).toBe(403);
  });

  it("creates, changes lifecycle state, and deletes only with the exact reference", async () => {
    const created = await createWholesalePackage();
    expect(created.reference).toMatch(/^JGC-W-[A-F0-9]{8}$/);

    const sold = await adminRequest(`/api/admin/wholesale/${created.id}/state`, { method: "PUT", body: JSON.stringify({ state: "sold" }) });
    await expect(sold.json()).resolves.toMatchObject({ state: "sold", soldAt: expect.stringMatching(/^20/) });
    const rejected = await adminRequest(`/api/admin/wholesale/${created.id}`, { method: "DELETE", body: JSON.stringify({ confirmReference: "wrong" }) });
    const deleted = await adminRequest(`/api/admin/wholesale/${created.id}`, { method: "DELETE", body: JSON.stringify({ confirmReference: created.reference }) });
    expect(rejected.status).toBe(409);
    expect(deleted.status).toBe(204);
  });

  it("names an invalid file in a multi-image upload without storing partial metadata", async () => {
    const created = await createWholesalePackage();
    const form = new FormData();
    form.append("images", jpegFile("good.jpg"));
    form.append("images", new File([new Uint8Array([1, 2, 3])], "bad.gif", { type: "image/gif" }));
    const response = await adminRequest(`/api/admin/wholesale/${created.id}/images`, { method: "POST", body: form });
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM wholesale_package_images").first<number>("total");

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("bad.gif") });
    expect(count).toBe(0);
  });

  it("removes registered R2 images when a package is permanently deleted", async () => {
    const created = await createWholesalePackage();
    const form = new FormData();
    form.append("images", jpegFile());
    const uploaded = await adminRequest(`/api/admin/wholesale/${created.id}/images`, { method: "POST", body: form });
    const body = (await uploaded.json()) as { images: Array<{ url: string }> };
    const objectKey = decodeURIComponent(body.images[0].url.replace("/media/", ""));
    expect(await env.PRODUCT_IMAGES.get(objectKey)).not.toBeNull();

    const deleted = await adminRequest(`/api/admin/wholesale/${created.id}`, { method: "DELETE", body: JSON.stringify({ confirmReference: created.reference }) });
    expect(deleted.status).toBe(204);
    expect(await env.PRODUCT_IMAGES.get(objectKey)).toBeNull();
  });

  it("rejects a cross-origin request even when it carries a session cookie", async () => {
    const response = await apiRequest("/api/admin/wholesale", {
      method: "POST",
      headers: { Origin: `${storeOrigin}.attacker.example`, Cookie: `${SESSION_COOKIE}=${adminToken}` },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
  });
});
