import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AdminCategory, AdminWholesalePackage, Audience, ProductImage, WholesaleConditionScope } from "../../shared/contracts";
import { wholesalePackageInputSchema, type WholesalePackageInput } from "../../shared/validation";
import { ApiRequestError, ownerApi } from "../api";

export function WholesaleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [conditionScope, setConditionScope] = useState<WholesaleConditionScope>("mixed");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pieceCount, setPieceCount] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [reference, setReference] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    ownerApi.categories(controller.signal).then((items) => setCategories(items.filter((item) => item.active))).catch(() => setErrors(["Clothing types could not be loaded."]));
    if (id) ownerApi.wholesalePackage(id, controller.signal).then(fill).catch(() => setErrors(["Wholesale package could not be loaded."]));
    return () => controller.abort();
  }, [id]);

  function fill(item: AdminWholesalePackage) {
    setName(item.name); setDescription(item.description); setAudiences(item.audiences); setConditionScope(item.conditionScope);
    setCategoryIds(item.categories.map((category) => category.id)); setPieceCount(String(item.pieceCount)); setPrice(String(item.priceKobo / 100));
    setStock(String(item.stockQuantity)); setReference(item.reference); setFeatured(item.featured); setPublished(item.published); setImages(item.images);
  }

  function toggleAudience(value: Audience) { setAudiences((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]); }
  function toggleCategory(value: string) { setCategoryIds((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    const input: WholesalePackageInput = {
      name: name.trim(), description: description.trim(), audiences, conditionScope, categoryIds,
      pieceCount: Number(pieceCount), priceKobo: Math.round(Number(price) * 100), stockQuantity: Number(stock), featured, published,
      reference: reference.trim() || undefined,
    };
    const parsed = wholesalePackageInputSchema.safeParse(input);
    if (!parsed.success) { setErrors(parsed.error.issues.map((issue) => issue.message)); return; }
    setBusy(true);
    try {
      const item = id ? await ownerApi.updateWholesale(id, parsed.data) : await ownerApi.createWholesale(parsed.data);
      const uploadErrors: string[] = [];
      for (const file of files) {
        try { await ownerApi.uploadWholesaleImage(item.id, file); }
        catch { uploadErrors.push(`${file.name} could not be uploaded. The package was saved; try adding this image again.`); }
      }
      if (uploadErrors.length) { setErrors(uploadErrors); if (!id) setReference(item.reference); }
      else navigate("/owner/wholesale", { replace: true });
    } catch (caught) {
      setErrors([caught instanceof ApiRequestError ? caught.message : "Wholesale package could not be saved."]);
    } finally { setBusy(false); }
  }

  return (
    <main className="admin-content">
      <header className="admin-page-head"><div><Link className="back-link" to="/owner/wholesale">← Wholesale</Link><p className="eyebrow">Package inventory</p><h1>{id ? "Edit wholesale package" : "New wholesale package"}</h1></div></header>
      <form className="product-form" onSubmit={submit} noValidate>
        {errors.length ? <div className="form-error-list" role="alert"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <section className="form-card"><div className="form-card__heading"><span>01</span><div><h2>Package details</h2><p>Describe the package customers will receive.</p></div></div><div className="form-fields">
          <label className="field field--wide">Package name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field field--wide">Description<textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="field">Piece count<input type="number" min="1" value={pieceCount} onChange={(event) => setPieceCount(event.target.value)} /></label>
          <label className="field">Price in Naira (₦)<input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <label className="field">Packages in stock<input type="number" min="0" max="999" value={stock} onChange={(event) => setStock(event.target.value)} /></label>
          <label className="field">Reference <span>(optional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <fieldset className="field field--wide condition-field"><legend>Condition scope</legend>{(["new", "thrifted", "mixed"] as WholesaleConditionScope[]).map((value) => <label key={value}><input type="radio" name="condition-scope" checked={conditionScope === value} onChange={() => setConditionScope(value)} /><span>{value[0].toUpperCase()}{value.slice(1)}</span></label>)}</fieldset>
          <fieldset className="field field--wide admin-size-field"><legend>Audiences</legend><div>{(["women", "men", "kids"] as Audience[]).map((value) => { const label = value === "kids" ? "Kids" : `${value[0].toUpperCase()}${value.slice(1)}`; return <label key={value}><input type="checkbox" aria-label={label} checked={audiences.includes(value)} onChange={() => toggleAudience(value)} /><span>{label}</span></label>; })}</div></fieldset>
          <fieldset className="field field--wide admin-size-field"><legend>Clothing types inside</legend><div>{categories.map((category) => <label key={category.id}><input type="checkbox" aria-label={category.name} checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} /><span>{category.name}</span></label>)}</div></fieldset>
        </div></section>
        <section className="form-card"><div className="form-card__heading"><span>02</span><div><h2>Representative images</h2><p>Show what the package looks like without listing every garment.</p></div></div>
          {images.length ? <div className="existing-images">{images.map((image) => <img key={image.id} src={image.url} alt={image.alt} />)}</div> : null}
          <label className="image-upload">Package images<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 6))} /><span><strong>Choose images</strong></span></label>
        </section>
        <section className="form-card"><div className="form-card__heading"><span>03</span><div><h2>Store visibility</h2></div></div><div className="toggle-fields"><label><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>Published</strong></span></label><label><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /><span><strong>Featured package</strong></span></label></div></section>
        <div className="product-form__actions"><Link className="button button--light" to="/owner/wholesale">Cancel</Link><button className="button button--dark" type="submit" disabled={busy}>{busy ? "Saving…" : "Save package"}</button></div>
      </form>
    </main>
  );
}
