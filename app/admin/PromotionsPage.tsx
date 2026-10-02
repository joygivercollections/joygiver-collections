import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminPromotion } from "../../shared/contracts";
import type { PromotionInput } from "../../shared/validation";
import { ownerApi } from "../api";

function asInput(item: AdminPromotion, paused: boolean): PromotionInput {
  return { name: item.name, description: item.description, requiredQuantity: item.requiredQuantity, discountBasisPoints: item.discountBasisPoints, startAt: item.startAt, endAt: item.endAt, paused, productIds: item.productIds, wholesalePackageIds: item.wholesalePackageIds };
}

export function PromotionsPage() {
  const [items, setItems] = useState<AdminPromotion[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => { ownerApi.promotions().then(setItems).catch(() => setNotice("Promotions could not be loaded.")); }, []);
  async function toggle(item: AdminPromotion) {
    const updated = await ownerApi.updatePromotion(item.id, asInput(item, !item.paused));
    setItems((values) => values.map((value) => value.id === item.id ? updated : value));
  }
  async function remove(item: AdminPromotion) { await ownerApi.deletePromotion(item.id); setItems((values) => values.filter((value) => value.id !== item.id)); }
  return <main className="admin-content"><header className="admin-page-head"><div><p className="eyebrow">Offers</p><h1>Promotions</h1><p>Schedule percentage discounts for complete groups of eligible cart items.</p></div><Link className="button button--dark" to="/owner/promotions/new">Add promotion</Link></header>{notice ? <p className="admin-notice">{notice}</p> : null}<section className="inventory-list">{items.map((item) => <article className="inventory-row" key={item.id}><div className="inventory-row__main"><div className="inventory-row__badges"><span>{item.paused ? "paused" : "scheduled"}</span></div><h2>{item.name}</h2><p>{item.requiredQuantity} items · {item.discountBasisPoints / 100}% off · {item.productIds.length + item.wholesalePackageIds.length} eligible listings</p><p>{new Date(item.startAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} – {new Date(item.endAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</p></div><div className="inventory-row__actions"><Link to={`/owner/promotions/${item.id}`}>Edit</Link><button type="button" onClick={() => toggle(item)}>{item.paused ? "Resume" : "Pause"}</button><button className="danger-link" type="button" onClick={() => remove(item)}>Delete</button></div></article>)}</section></main>;
}
