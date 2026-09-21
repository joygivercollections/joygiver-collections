import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AdminCategory, AdminProduct, ProductCondition, ProductImage } from "../../shared/contracts";
import { productInputSchema, type ProductInput } from "../../shared/validation";
import { ApiRequestError, ownerApi } from "../api";

const commonSizes = [
  ["XS", "Extra small"], ["S", "Small"], ["M", "Medium"], ["L", "Large"], ["XL", "Extra large"], ["One size", "One size"],
] as const;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("new");
  const [categoryId, setCategoryId] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [stock, setStock] = useState("1");
  const [reference, setReference] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadingFile, setUploadingFile] = useState("");
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    const controller = new AbortController();
    ownerApi.categories(controller.signal).then((items) => {
      setCategories(items.filter((item) => item.active));
      setCategoryId((current) => current || items.find((item) => item.active)?.id || "");
    }).catch(() => setErrors(["Categories could not be loaded."]));
    if (id) {
      ownerApi.product(id, controller.signal).then(fillFromProduct).catch(() => setErrors(["Product could not be loaded."])).finally(() => setLoading(false));
    }
    return () => controller.abort();
  }, [id]);

  function fillFromProduct(product: AdminProduct) {
    setName(product.name); setDescription(product.description); setPrice(String(product.priceKobo / 100)); setCondition(product.condition);
    setCategoryId(product.category.id); setSizes(product.sizes); setTags(product.tags.join(", ")); setStock(String(product.stockQuantity));
    setReference(product.reference); setFeatured(product.featured); setPublished(product.published); setImages(product.images);
  }

  function toggleSize(size: string) {
    setSizes((items) => items.includes(size) ? items.filter((item) => item !== size) : [...items, size]);
  }

  function selectFiles(selected: FileList | null) {
    if (!selected) return;
    setFiles(Array.from(selected).slice(0, Math.max(0, 6 - images.length)));
    setErrors([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    const localErrors: string[] = [];
    if (!categoryId) localErrors.push("Choose a category.");
    if (sizes.length === 0) localErrors.push("Choose at least one size.");
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) localErrors.push("Enter a valid price.");
    if (condition === "thrifted" && Number(stock) > 1) localErrors.push("Thrifted products can have only one item in stock.");
    const invalidFiles = files.filter((file) => file.size > MAX_IMAGE_BYTES || !ACCEPTED_IMAGE_TYPES.has(file.type));
    invalidFiles.forEach((file) => localErrors.push(`${file.name} could not be uploaded. Use a JPEG, PNG or WebP image no larger than 8 MB.`));
    if (localErrors.some((error) => !error.includes("could not be uploaded"))) { setErrors(localErrors); return; }

    const input: ProductInput = {
      name: name.trim(), description: description.trim(), priceKobo: Math.round(Number(price) * 100), condition, categoryId,
      sizes, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), stockQuantity: Number(stock), featured, published,
      audiences: ["women"], isUnisex: false,
      reference: reference.trim() || undefined,
    };
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setBusy(true);
    try {
      const product = id ? await ownerApi.updateProduct(id, parsed.data) : await ownerApi.createProduct(parsed.data);
      const uploadErrors = [...localErrors];
      for (const file of files.filter((item) => !invalidFiles.includes(item))) {
        setUploadingFile(file.name);
        try { await ownerApi.uploadImage(product.id, file); }
        catch { uploadErrors.push(`${file.name} could not be uploaded. The product was saved; try adding this image again.`); }
      }
      setUploadingFile("");
      if (uploadErrors.length) {
        setErrors(uploadErrors);
        if (!id) setReference(product.reference);
      } else {
        navigate("/owner/products", { replace: true });
      }
    } catch (caught) {
      setErrors([caught instanceof ApiRequestError ? caught.message : "Product could not be saved. Please try again."]);
    } finally { setUploadingFile(""); setBusy(false); }
  }

  async function deleteImage(image: ProductImage) {
    if (!id) return;
    await ownerApi.deleteImage(id, image.id);
    setImages((items) => items.filter((item) => item.id !== image.id));
  }

  async function moveImage(index: number, direction: -1 | 1) {
    if (!id) return;
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    try { const result = await ownerApi.reorderImages(id, next.map((image) => image.id)); setImages(result.images); } catch { setErrors(["Image order could not be saved."]); }
  }

  if (loading) return <main className="admin-content"><p>Loading product…</p></main>;

  return (
    <main className="admin-content">
      <header className="admin-page-head admin-page-head--form"><div><Link className="back-link" to="/owner/products">← Products</Link><p className="eyebrow">{id ? "Update the edit" : "Add to the edit"}</p><h1>{id ? "Edit product" : "New product"}</h1><p>Clear details and strong photos help customers order with confidence.</p></div></header>
      <form className="product-form" onSubmit={submit}>
        {errors.length ? <div className="form-error-list" role="alert"><strong>Please check the following:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        <section className="form-card"><div className="form-card__heading"><span>01</span><div><h2>Product details</h2><p>The essentials customers see while browsing.</p></div></div><div className="form-fields">
          <label className="field field--wide">Product name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>
          <label className="field field--wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required /></label>
          <label className="field">Price in Naira (₦)<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="18500" required /></label>
          <label className="field">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <fieldset className="field field--wide condition-field"><legend>Condition</legend><label><input type="radio" name="condition" value="new" checked={condition === "new"} onChange={() => setCondition("new")} /><span>New<small>Brand-new product</small></span></label><label><input type="radio" name="condition" value="thrifted" checked={condition === "thrifted"} onChange={() => { setCondition("thrifted"); setStock("1"); }} /><span>Thrifted<small>One-of-one pre-loved find</small></span></label></fieldset>
          <fieldset className="field field--wide admin-size-field"><legend>Available sizes</legend><div>{commonSizes.map(([value, label]) => <label key={value}><input type="checkbox" aria-label={label} checked={sizes.includes(value)} onChange={() => toggleSize(value)} /><span>{value}<small>{label}</small></span></label>)}</div></fieldset>
          <label className="field">Stock quantity<input type="number" min="0" max={condition === "thrifted" ? 1 : 999} value={stock} onChange={(event) => setStock(event.target.value)} required /></label>
          <label className="field">Reference <span>(optional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Generated automatically" /></label>
          <label className="field field--wide">Tags <span>(comma separated)</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="elegant, occasion, summer" /></label>
        </div></section>

        <section className="form-card"><div className="form-card__heading"><span>02</span><div><h2>Product images</h2><p>Add up to six images. The first image is shown in the catalogue.</p></div></div>
          {images.length ? <div className="existing-images">{images.map((image, index) => <article key={image.id}><img src={image.url} alt={image.alt} /><p>{index === 0 ? "Cover image" : `Image ${index + 1}`}</p><div><button type="button" disabled={index === 0} onClick={() => moveImage(index, -1)}>←</button><button type="button" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>→</button><button type="button" onClick={() => deleteImage(image)}>Delete</button></div></article>)}</div> : null}
          <label className="image-upload">Product images<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} /><span><strong>Choose images</strong><small>JPEG, PNG or WebP · up to 8 MB each</small></span></label>
          {files.length ? <ul className="selected-files">{files.map((file) => <li key={`${file.name}-${file.size}`}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></li>)}</ul> : null}
        </section>

        <section className="form-card"><div className="form-card__heading"><span>03</span><div><h2>Store visibility</h2><p>Choose how this piece appears to customers.</p></div></div><div className="toggle-fields"><label><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>Published</strong><small>Visible on the storefront when available</small></span></label><label><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /><span><strong>Featured piece</strong><small>Available for highlighted placements</small></span></label></div></section>
        {uploadingFile ? <p className="admin-notice" role="status">Uploading {uploadingFile}…</p> : null}
        <div className="product-form__actions"><Link className="button button--light" to="/owner/products">Cancel</Link><button className="button button--dark" type="submit" disabled={busy}>{busy ? "Saving…" : "Save product"}</button></div>
      </form>
    </main>
  );
}
