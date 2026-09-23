import { FormEvent, useEffect, useRef, useState } from "react";
import type { SiteSettings } from "../../shared/contracts";
import { ApiRequestError, ownerApi } from "../api";

export function SiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [heading, setHeading] = useState("");
  const [copy, setCopy] = useState("");
  const [notice, setNotice] = useState("");
  const previewUrls = useRef<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    ownerApi.settings(controller.signal).then((value) => { setSettings(value); setHeading(value.heroHeading); setCopy(value.heroCopy); }).catch(() => setNotice("Site settings could not be loaded."));
    return () => { controller.abort(); previewUrls.current.forEach((url) => URL.revokeObjectURL?.(url)); };
  }, []);

  async function saveCopy(event: FormEvent) {
    event.preventDefault(); setNotice("");
    try { const value = await ownerApi.updateSettings({ heroHeading: heading, heroCopy: copy }); setSettings(value); setNotice("Homepage copy was saved."); }
    catch (caught) { setNotice(caught instanceof ApiRequestError ? caught.message : "Homepage copy could not be saved."); }
  }

  async function replace(slot: "logo" | "hero", file?: File) {
    if (!file || !settings) return;
    setNotice("");
    let preview = "";
    if (typeof URL.createObjectURL === "function") { preview = URL.createObjectURL(file); previewUrls.current.push(preview); setSettings((value) => value ? { ...value, [slot === "logo" ? "logoUrl" : "heroUrl"]: preview } : value); }
    try {
      const value = await ownerApi.replaceSiteAsset(slot, file);
      setSettings(value); setNotice(`${slot === "logo" ? "Logo" : "Hero image"} was updated.`);
    } catch (caught) {
      if (preview) setSettings((value) => value ? { ...value, [slot === "logo" ? "logoUrl" : "heroUrl"]: slot === "logo" ? settings.logoUrl : settings.heroUrl } : value);
      setNotice(caught instanceof ApiRequestError ? caught.message : "Image could not be updated.");
    } finally { if (preview) { URL.revokeObjectURL?.(preview); previewUrls.current = previewUrls.current.filter((url) => url !== preview); } }
  }

  if (!settings) return <main className="admin-content"><p>{notice || "Loading site settings…"}</p></main>;
  return <main className="admin-content"><header className="admin-page-head"><div><p className="eyebrow">Brand controls</p><h1>Site Settings</h1><p>Replace the logo and hero image or update the homepage message without changing code.</p></div></header>
    {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
    <section className="site-assets">
      <article><h2>Logo</h2><img src={settings.logoUrl} alt="Current Joygiver logo" /><label>Replace logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => replace("logo", event.target.files?.[0])} /></label><p>JPEG, PNG or WebP, up to 8 MB. Use a clean brand mark with readable contrast.</p></article>
      <article><h2>Hero image</h2><img src={settings.heroUrl} alt="Current hero" /><label>Replace hero<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => replace("hero", event.target.files?.[0])} /></label><p>JPEG, PNG or WebP, up to 8 MB. Choose a composition with meaningful product context for Women, Men, and Kids.</p></article>
    </section>
    <form className="form-card" onSubmit={saveCopy}><div className="form-card__heading"><span>03</span><div><h2>Homepage copy</h2></div></div><div className="form-fields"><label className="field field--wide">Hero heading<input value={heading} onChange={(event) => setHeading(event.target.value)} /></label><label className="field field--wide">Hero supporting copy<textarea rows={4} value={copy} onChange={(event) => setCopy(event.target.value)} /></label></div><button className="button button--dark" type="submit">Save homepage copy</button></form>
  </main>;
}
