import type { SiteSettings } from "../../shared/contracts";
import type { SiteSettingsInput } from "../../shared/validation";
import { imageUrl, validateImageFile } from "../lib/images";

type SiteAssetSlot = "logo" | "hero";

interface SettingsRow {
  logo_object_key: string | null;
  hero_object_key: string | null;
  hero_heading: string;
  hero_copy: string;
}

export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db.prepare("SELECT logo_object_key, hero_object_key, hero_heading, hero_copy FROM site_settings WHERE id = 'store'").first<SettingsRow>();
  if (!row) throw new Error("Site settings are missing");
  return {
    logoUrl: row.logo_object_key ? imageUrl(row.logo_object_key) : "/brand/joygiver-logo.jpeg",
    heroUrl: row.hero_object_key ? imageUrl(row.hero_object_key) : "/brand/family-hero.png",
    heroHeading: row.hero_heading,
    heroCopy: row.hero_copy,
  };
}

export async function updateSiteCopy(db: D1Database, input: SiteSettingsInput, now = new Date()): Promise<SiteSettings> {
  await db.prepare("UPDATE site_settings SET hero_heading = ?, hero_copy = ?, updated_at = ? WHERE id = 'store'").bind(input.heroHeading, input.heroCopy, now.toISOString()).run();
  return getSiteSettings(db);
}

export async function replaceSiteAsset(
  db: D1Database,
  bucket: R2Bucket,
  slot: SiteAssetSlot,
  file: File,
  updateOverride?: (objectKey: string, contentType: string) => Promise<unknown>,
): Promise<SiteSettings> {
  const contentType = await validateImageFile(file);
  const keyColumn = slot === "logo" ? "logo_object_key" : "hero_object_key";
  const typeColumn = slot === "logo" ? "logo_content_type" : "hero_content_type";
  const previous = await db.prepare(`SELECT ${keyColumn} AS object_key FROM site_settings WHERE id = 'store'`).first<{ object_key: string | null }>();
  if (!previous) throw new Error("Site settings are missing");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const objectKey = `site/${slot}/${crypto.randomUUID()}.${extension}`;
  await bucket.put(objectKey, file.stream(), { httpMetadata: { contentType } });
  try {
    if (updateOverride) await updateOverride(objectKey, contentType);
    else await db.prepare(`UPDATE site_settings SET ${keyColumn} = ?, ${typeColumn} = ?, updated_at = ? WHERE id = 'store'`).bind(objectKey, contentType, new Date().toISOString()).run();
  } catch (error) {
    await bucket.delete(objectKey).catch(() => undefined);
    throw error;
  }
  if (previous.object_key && previous.object_key !== objectKey) await bucket.delete(previous.object_key).catch(() => undefined);
  return getSiteSettings(db);
}
