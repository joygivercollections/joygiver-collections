import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AdminProduct, AdminPromotion, AdminWholesalePackage } from "../../shared/contracts";
import { promotionInputSchema, type PromotionInput } from "../../shared/validation";
import { ApiRequestError, ownerApi } from "../api";
import { Pagination } from "../components/Pagination";

export function watLocalToUtc(value: string): string {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalized}+01:00`).toISOString();
}

export function utcToWatLocal(value: string): string {
  return new Date(Date.parse(value) + 60 * 60 * 1_000).toISOString().slice(0, 16);
}

export function PromotionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [packages, setPackages] = useState<AdminWholesalePackage[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requiredQuantity, setRequiredQuantity] = useState("6");
  const [discountPercent, setDiscountPercent] = useState("15");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [paused, setPaused] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [packageIds, setPackageIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [packagePage, setPackagePage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [packageTotal, setPackageTotal] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<AdminProduct[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<AdminWholesalePackage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      ownerApi.products({ limit: "20", page: String(productPage), search: productSearch.trim() || undefined }, controller.signal)
        .then((result) => { setProducts(result.items); setProductTotal(result.total); })
        .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setErrors(["Eligible retail inventory could not be loaded."]); });
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [productPage, productSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      ownerApi.wholesale({ limit: "20", page: String(packagePage), search: packageSearch.trim() || undefined }, controller.signal)
        .then((result) => { setPackages(result.items); setPackageTotal(result.total); })
        .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setErrors(["Eligible wholesale inventory could not be loaded."]); });
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [packagePage, packageSearch]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    ownerApi.promotion(id, controller.signal).then(async (item) => {
      fill(item);
      const [retail, wholesale] = await Promise.all([
        Promise.all(item.productIds.map((productId) => ownerApi.product(productId, controller.signal))),
        Promise.all(item.wholesalePackageIds.map((packageId) => ownerApi.wholesalePackage(packageId, controller.signal))),
      ]);
      setSelectedProducts(retail);
      setSelectedPackages(wholesale);
    }).catch(() => setErrors(["Promotion could not be loaded."]));
    return () => controller.abort();
  }, [id]);

  function fill(item: AdminPromotion) {
    setName(item.name); setDescription(item.description); setRequiredQuantity(String(item.requiredQuantity)); setDiscountPercent(String(item.discountBasisPoints / 100));
    setStartAt(utcToWatLocal(item.startAt)); setEndAt(utcToWatLocal(item.endAt)); setPaused(item.paused); setProductIds(item.productIds); setPackageIds(item.wholesalePackageIds);
  }

  const preview = `Every complete group of ${Number(requiredQuantity) || 0} eligible cart items receives ${Number(discountPercent) || 0}% off.`;
  function toggleProduct(item: AdminProduct) {
    const selected = productIds.includes(item.id);
    setProductIds(selected ? productIds.filter((value) => value !== item.id) : [...productIds, item.id]);
    setSelectedProducts((values) => selected ? values.filter((value) => value.id !== item.id) : values.some((value) => value.id === item.id) ? values : [...values, item]);
  }
  function togglePackage(item: AdminWholesalePackage) {
    const selected = packageIds.includes(item.id);
    setPackageIds(selected ? packageIds.filter((value) => value !== item.id) : [...packageIds, item.id]);
    setSelectedPackages((values) => selected ? values.filter((value) => value.id !== item.id) : values.some((value) => value.id === item.id) ? values : [...values, item]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setErrors([]);
    let input: PromotionInput;
    try {
      input = { name: name.trim(), description: description.trim(), requiredQuantity: Number(requiredQuantity), discountBasisPoints: Math.round(Number(discountPercent) * 100), startAt: watLocalToUtc(startAt), endAt: watLocalToUtc(endAt), paused, productIds, wholesalePackageIds: packageIds };
    } catch { setErrors(["Enter valid start and end times."]); return; }
    const parsed = promotionInputSchema.safeParse(input);
    if (!parsed.success) { setErrors(parsed.error.issues.map((issue) => issue.message)); return; }
    setBusy(true);
    try { if (id) await ownerApi.updatePromotion(id, parsed.data); else await ownerApi.createPromotion(parsed.data); navigate("/owner/promotions", { replace: true }); }
    catch (caught) { setErrors([caught instanceof ApiRequestError ? caught.message : "Promotion could not be saved."]); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><header className="admin-page-head"><div><Link className="back-link" to="/owner/promotions">← Promotions</Link><p className="eyebrow">Scheduled offer</p><h1>{id ? "Edit promotion" : "New promotion"}</h1></div></header>
    <form className="product-form" onSubmit={submit} noValidate>{errors.length ? <div className="form-error-list" role="alert"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      <section className="form-card"><div className="form-card__heading"><span>01</span><div><h2>Offer rule</h2></div></div><div className="form-fields">
        <label className="field field--wide">Promotion name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field field--wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="field">Eligible quantity<input type="number" min="2" max="100" value={requiredQuantity} onChange={(event) => setRequiredQuantity(event.target.value)} /></label><label className="field">Discount percentage<input type="number" min="0.01" max="99" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} /></label>
        <p className="field field--wide admin-notice">{preview}</p>
      </div></section>
      <section className="form-card"><div className="form-card__heading"><span>02</span><div><h2>Schedule</h2><p>Africa/Lagos (WAT), UTC+1</p></div></div><div className="form-fields"><label className="field">Starts<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></label><label className="field">Ends<input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /></label><label className="field field--wide"><input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} /> Pause this promotion</label></div></section>
      <section className="form-card"><div className="form-card__heading"><span>03</span><div><h2>Eligible inventory</h2></div></div><div className="promotion-eligibility">
        <div><label>Search retail products<input value={productSearch} onChange={(event) => { setProductPage(1); setProductSearch(event.target.value); }} /></label><p>{selectedProducts.length} selected</p>{selectedProducts.map((item) => <button type="button" key={`selected-${item.id}`} onClick={() => toggleProduct(item)}>Remove {item.name}</button>)}{products.map((item) => <label key={item.id}><input type="checkbox" aria-label={item.name} checked={productIds.includes(item.id)} onChange={() => toggleProduct(item)} />{item.name} <small>{item.reference}</small></label>)}<Pagination page={productPage} pageSize={20} total={productTotal} label="retail products" onPageChange={setProductPage} /></div>
        <div><label>Search wholesale packages<input value={packageSearch} onChange={(event) => { setPackagePage(1); setPackageSearch(event.target.value); }} /></label><p>{selectedPackages.length} selected</p>{selectedPackages.map((item) => <button type="button" key={`selected-${item.id}`} onClick={() => togglePackage(item)}>Remove {item.name}</button>)}{packages.map((item) => <label key={item.id}><input type="checkbox" aria-label={item.name} checked={packageIds.includes(item.id)} onChange={() => togglePackage(item)} />{item.name} <small>{item.reference}</small></label>)}<Pagination page={packagePage} pageSize={20} total={packageTotal} label="wholesale packages" onPageChange={setPackagePage} /></div>
      </div></section>
      <div className="product-form__actions"><Link className="button button--light" to="/owner/promotions">Cancel</Link><button className="button button--dark" type="submit" disabled={busy}>{busy ? "Saving…" : "Save promotion"}</button></div>
    </form>
  </main>;
}
