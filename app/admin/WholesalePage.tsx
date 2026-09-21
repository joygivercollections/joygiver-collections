import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminWholesalePackage } from "../../shared/contracts";
import { formatNaira, ownerApi } from "../api";

export function WholesalePage() {
  const [items, setItems] = useState<AdminWholesalePackage[]>([]);
  const [target, setTarget] = useState<AdminWholesalePackage | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => { ownerApi.wholesale().then((result) => setItems(result.items)).catch(() => setNotice("Wholesale inventory could not be loaded.")); }, []);
  useEffect(() => { if (target) confirmationRef.current?.focus(); }, [target]);

  async function changeState(item: AdminWholesalePackage, state: "available" | "sold" | "hidden") {
    const updated = await ownerApi.setWholesaleState(item.id, state);
    setItems((values) => values.map((value) => value.id === item.id ? updated : value));
  }

  async function remove() {
    if (!target || confirmation !== target.reference) return;
    await ownerApi.deleteWholesale(target.id, confirmation);
    setItems((values) => values.filter((value) => value.id !== target.id));
    setTarget(null); setConfirmation("");
  }

  return (
    <main className="admin-content">
      <header className="admin-page-head"><div><p className="eyebrow">Wholesale</p><h1>Package Inventory</h1><p>Manage package photos, piece counts, prices, and availability.</p></div><Link className="button button--dark" to="/owner/wholesale/new">Add package</Link></header>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <section className="inventory-list" aria-label="Wholesale packages">{items.map((item) => <article className="inventory-row" key={item.id}>
        <div className="inventory-row__image">{item.primaryImage ? <img src={item.primaryImage.url} alt="" /> : <span>J</span>}</div>
        <div className="inventory-row__main"><div className="inventory-row__badges"><span>{item.conditionScope}</span><span className={`status status--${item.state}`}>{item.state}</span></div><h2>{item.name}</h2><p>{item.reference} · {item.pieceCount} pieces · {item.audiences.join(", ")}</p></div>
        <div className="inventory-row__stock"><strong>{formatNaira(item.priceKobo)}</strong><span>{item.stockQuantity} packages</span></div>
        <div className="inventory-row__actions"><Link to={`/owner/wholesale/${item.id}`}>Edit</Link>{item.state === "sold" ? <button type="button" onClick={() => changeState(item, "available")}>Restore</button> : <button type="button" onClick={() => changeState(item, "sold")}>Mark sold</button>}{item.state !== "hidden" ? <button type="button" onClick={() => changeState(item, "hidden")}>Hide</button> : <button type="button" onClick={() => changeState(item, "available")}>Restore</button>}<button className="danger-link" type="button" aria-label={`Delete ${item.name}`} onClick={() => { setTarget(item); setConfirmation(""); }}>Delete</button></div>
      </article>)}</section>
      {target ? <div className="admin-dialog-backdrop"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-package-title"><h2 id="delete-package-title">Delete {target.name}?</h2><p>This removes the package and its images permanently.</p><label>Type package reference <strong>{target.reference}</strong><input ref={confirmationRef} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><div><button className="button button--light" type="button" onClick={() => setTarget(null)}>Cancel</button><button className="button button--danger" type="button" disabled={confirmation !== target.reference} onClick={remove}>Delete permanently</button></div></section></div> : null}
    </main>
  );
}
