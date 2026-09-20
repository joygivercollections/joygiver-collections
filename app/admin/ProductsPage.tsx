import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminProduct } from "../../shared/contracts";
import { formatNaira, ownerApi } from "../api";

export function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    const controller = new AbortController();
    setLoading(true);
    ownerApi.products({ search: query || undefined, condition: condition || undefined, state: state || undefined }, controller.signal)
      .then((result) => { setProducts(result.items); setTotal(result.total); })
      .catch(() => setNotice("Inventory could not be loaded. Please try again."))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }
  useEffect(load, [query, condition, state]);

  function submitSearch(event: FormEvent) { event.preventDefault(); setQuery(search.trim()); }

  async function changeState(product: AdminProduct, nextState: "available" | "sold" | "hidden") {
    const updated = await ownerApi.setProductState(product.id, nextState);
    setProducts((items) => items.map((item) => item.id === product.id ? updated : item));
    setNotice(nextState === "sold" ? `${product.name} marked sold. It will remain visible for 48 hours.` : `${product.name} is now ${nextState}.`);
  }

  async function permanentlyDelete() {
    if (!deleteTarget || confirmation !== deleteTarget.reference) return;
    await ownerApi.deleteProduct(deleteTarget.id, confirmation);
    setProducts((items) => items.filter((item) => item.id !== deleteTarget.id));
    setTotal((value) => Math.max(0, value - 1));
    setNotice(`${deleteTarget.name} was permanently deleted.`);
    setDeleteTarget(null);
    setConfirmation("");
  }

  return (
    <main className="admin-content">
      <header className="admin-page-head"><div><p className="eyebrow">Catalogue</p><h1>Products</h1><p>Manage every new piece and thrifted find, including sold items.</p></div><Link className="button button--dark" to="/owner/products/new">Add product</Link></header>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <section className="inventory-tools" aria-label="Inventory filters">
        <form role="search" onSubmit={submitSearch}><label className="sr-only" htmlFor="inventory-search">Search inventory</label><input id="inventory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or reference" /><button type="submit">Search</button></form>
        <select aria-label="Filter by condition" value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">All conditions</option><option value="new">New</option><option value="thrifted">Thrifted</option></select>
        <select aria-label="Filter by status" value={state} onChange={(event) => setState(event.target.value)}><option value="">All statuses</option><option value="available">Available</option><option value="sold">Sold</option><option value="hidden">Hidden</option></select>
      </section>
      <div className="inventory-count"><p>{loading ? "Loading inventory…" : `${total} ${total === 1 ? "product" : "products"}`}</p></div>
      <section className="inventory-list" aria-label="Products">
        {products.map((product) => (
          <article className="inventory-row" key={product.id}>
            <div className="inventory-row__image">{product.primaryImage ? <img src={product.primaryImage.url} alt="" /> : <span>J</span>}</div>
            <div className="inventory-row__main"><div className="inventory-row__badges"><span>{product.condition}</span><span className={`status status--${product.state}`}>{product.state}</span>{!product.published ? <span>draft</span> : null}</div><h2>{product.name}</h2><p>{product.reference} · {product.category.name}</p></div>
            <div className="inventory-row__stock"><strong>{formatNaira(product.priceKobo)}</strong><span>{product.stockQuantity} in stock</span></div>
            <div className="inventory-row__actions">
              <Link to={`/owner/products/${product.id}`}>Edit</Link>
              {product.state === "sold" ? <button type="button" onClick={() => changeState(product, "available")}>Restore</button> : <button type="button" onClick={() => changeState(product, "sold")}>Mark sold</button>}
              {product.state !== "hidden" ? <button type="button" onClick={() => changeState(product, "hidden")}>Hide</button> : null}
              <button className="danger-link" type="button" aria-label={`Delete ${product.name}`} onClick={() => { setDeleteTarget(product); setConfirmation(""); }}>Delete</button>
            </div>
          </article>
        ))}
        {!loading && products.length === 0 ? <div className="admin-empty"><h2>No products found</h2><p>Try another filter or add the first product to this collection.</p></div> : null}
      </section>

      {deleteTarget ? <div className="admin-dialog-backdrop"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><p className="eyebrow">Permanent action</p><h2 id="delete-title">Delete {deleteTarget.name}?</h2><p>This removes the product and all its images. It cannot be undone.</p><label>Type product reference <strong>{deleteTarget.reference}</strong><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoFocus /></label><div><button className="button button--light" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="button button--danger" type="button" disabled={confirmation !== deleteTarget.reference} onClick={permanentlyDelete}>Delete permanently</button></div></section></div> : null}
    </main>
  );
}
