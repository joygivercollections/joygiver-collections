import { useEffect, useState } from "react";
import type { WholesalePackageSummary } from "../../shared/contracts";
import { getWholesalePackages } from "../api";
import { WholesaleCard } from "../components/WholesaleCard";
import { Pagination } from "../components/Pagination";
import { RouteError } from "../components/RouteError";

export function WholesalePage() {
  const [items, setItems] = useState<WholesalePackageSummary[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getWholesalePackages({ sort: "latest", page, limit: 24 }, controller.signal).then((result) => { setItems(result.items); setPageSize(result.pageSize); setTotal(result.total); }).catch((caught: unknown) => {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true);
    });
    return () => controller.abort();
  }, [page, retry]);

  return (
    <main className="wholesale-page page-width">
      <header className="catalogue__header"><p className="eyebrow">Buy in quantity</p><h1>Wholesale Packages</h1><p>See the package photo, clothing types, piece count, and total price—without browsing every garment inside.</p></header>
      {error ? <RouteError onRetry={() => setRetry((value) => value + 1)} /> : null}
      {!items && !error ? <p>Loading wholesale packages…</p> : null}
      {items ? <><section className="wholesale-grid" aria-label="Wholesale packages">{items.map((item) => <WholesaleCard key={item.id} item={item} />)}{items.length === 0 ? <p>No wholesale packages are available yet.</p> : null}</section>{total > pageSize ? <Pagination page={page} pageSize={pageSize} total={total} label="packages" onPageChange={setPage} /> : null}</> : null}
    </main>
  );
}
