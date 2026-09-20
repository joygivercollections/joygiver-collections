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
      <section className="admin-quick-actions"><div><p className="eyebrow">Quick actions</p><h2>Keep the edit current.</h2></div><div><Link to="/owner/products/new"><strong>Add new arrival</strong><span>Upload photos and publish a piece →</span></Link><Link to="/owner/products"><strong>Manage inventory</strong><span>Mark sold, hide or update products →</span></Link><Link to="/owner/categories"><strong>Organise categories</strong><span>Keep shopping filters useful →</span></Link></div></section>
    </main>
  );
}
