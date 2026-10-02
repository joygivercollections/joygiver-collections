import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { InventorySummary } from "../../shared/contracts";
import { ownerApi } from "../api";

export function DashboardPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    ownerApi.summary(controller.signal).then(setSummary).catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <main className="admin-content">
      <header className="admin-page-head"><div><p className="eyebrow">At a glance</p><h1>Welcome back.</h1><p>Here’s what is happening across the Joygiver collection.</p></div><Link className="button button--dark" to="/owner/products/new">Add a product</Link></header>
      <section className="stat-grid" aria-label="Inventory summary">
        {[['Total pieces', summary?.total], ['Available', summary?.available], ['Sold', summary?.sold], ['New', summary?.new], ['Thrifted', summary?.thrifted]].map(([label, value], index) => <article key={String(label)}><span>0{index + 1}</span><strong>{value ?? "—"}</strong><p>{label}</p></article>)}
      </section>
      <section className="audience-summary" aria-label="Retail audiences">
        <article><strong>{summary?.retailByAudience.women ?? "—"}</strong><p>Women</p></article>
        <article><strong>{summary?.retailByAudience.men ?? "—"}</strong><p>Men</p></article>
        <article><strong>{summary?.retailByAudience.kids ?? "—"}</strong><p>Kids</p></article>
        <article><strong>{summary?.availableWholesalePackages ?? "—"}</strong><p>Wholesale available</p></article>
      </section>
      <section className="promotion-overview" aria-label="Promotion overview">
        <p className="eyebrow">{summary?.promotion?.status === "active" ? "Current promotion" : "Next promotion"}</p>
        {summary?.promotion ? <><h2>{summary.promotion.name}</h2><p>{summary.promotion.requiredQuantity} eligible items unlock {summary.promotion.discountBasisPoints / 100}% off each complete group.</p></> : <><h2>No promotion scheduled.</h2><p>Create a timed offer whenever the collection is ready.</p></>}
      </section>
      <section className="admin-quick-actions"><div><p className="eyebrow">Quick actions</p><h2>Keep the edit current.</h2></div><div><Link to="/owner/products"><strong>Products</strong><span>Add, update, hide, or mark pieces sold →</span></Link><Link to="/owner/wholesale"><strong>Wholesale</strong><span>Manage package photos, counts, and prices →</span></Link><Link to="/owner/promotions"><strong>Promotions</strong><span>Schedule complete-group discounts →</span></Link><Link to="/owner/categories"><strong>Clothing Types</strong><span>Set types for Women, Men, and Kids →</span></Link><Link to="/owner/site-settings"><strong>Site Settings</strong><span>Replace the logo, hero, and homepage copy →</span></Link></div></section>
    </main>
  );
}
