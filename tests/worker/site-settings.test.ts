import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { replaceSiteAsset } from "../../worker/db/site-settings";
import { adminRequest, apiRequest, resetStore, seedAdminSession } from "./helpers";

function pngFile(name = "hero.png") {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])], name, { type: "image/png" });
}

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await resetStore(); await seedAdminSession();
  await env.DB.prepare("UPDATE site_settings SET logo_object_key = NULL, logo_content_type = NULL, hero_object_key = NULL, hero_content_type = NULL").run();
});

it("returns family-focused fallback settings", async () => {
  const response = await apiRequest("/api/settings");
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    logoUrl: "/brand/joygiver-logo.jpeg", heroUrl: "/brand/family-hero.png",
    heroHeading: "Style for every story.",
  });
});

it("protects text updates and rejects invalid assets without changing settings", async () => {
  expect((await apiRequest("/api/admin/settings", { method: "PUT", body: JSON.stringify({ heroHeading: "Family style", heroCopy: "For everyone." }) })).status).toBe(403);
  const invalid = new FormData(); invalid.append("image", new File([new Uint8Array([1, 2, 3])], "logo.gif", { type: "image/gif" }));
  expect((await adminRequest("/api/admin/settings/logo", { method: "POST", body: invalid })).status).toBe(415);
  expect((await adminRequest("/api/admin/settings/banner", { method: "POST", body: invalid })).status).toBe(400);
  const settings = await apiRequest("/api/settings");
  await expect(settings.json()).resolves.toMatchObject({ logoUrl: "/brand/joygiver-logo.jpeg" });
});

it("removes a replacement object when D1 update fails and deletes the old object only after success", async () => {
  const oldKey = "site/hero/old.png";
  await env.PRODUCT_IMAGES.put(oldKey, pngFile().stream(), { httpMetadata: { contentType: "image/png" } });
  await env.DB.prepare("UPDATE site_settings SET hero_object_key = ?, hero_content_type = ? WHERE id = 'store'").bind(oldKey, "image/png").run();

  await expect(replaceSiteAsset(env.DB, env.PRODUCT_IMAGES, "hero", pngFile(), async () => { throw new Error("injected D1 failure"); })).rejects.toThrow(/injected D1 failure/i);
  expect(await env.DB.prepare("SELECT hero_object_key FROM site_settings WHERE id = 'store'").first<string>("hero_object_key")).toBe(oldKey);
  expect(await env.PRODUCT_IMAGES.get(oldKey)).not.toBeNull();
  expect((await env.PRODUCT_IMAGES.list({ prefix: "site/hero/" })).objects.map((item) => item.key)).toEqual([oldKey]);

  const updated = await replaceSiteAsset(env.DB, env.PRODUCT_IMAGES, "hero", pngFile("new.png"));
  expect(updated.heroUrl).not.toContain("old.png");
  expect(await env.PRODUCT_IMAGES.get(oldKey)).toBeNull();
});
