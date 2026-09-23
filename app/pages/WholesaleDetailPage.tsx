import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { WholesalePackage } from "../../shared/contracts";
import { formatNaira, getWholesalePackage } from "../api";
import { upsertWholesaleCartLine } from "../cart/cart-store";
import { RouteError } from "../components/RouteError";
import { ProductGallery } from "../components/ProductGallery";

export function WholesaleDetailPage() {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<WholesalePackage | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getWholesalePackage(slug, controller.signal).then(setItem).catch(() => setError(true));
    return () => controller.abort();
  }, [slug]);

  if (error) return <div className="page-width"><RouteError title="Package unavailable" /></div>;
  if (!item) return <div className="page-width product-detail--loading" aria-label="Loading wholesale package" />;
  const sold = item.state === "sold" || item.stockQuantity <= 0;
  const resolvedQuantity = Math.max(1, Math.min(item.stockQuantity, Number(quantity) || 1));
  const audience = item.audiences.map((value) => value === "kids" ? "Kids" : `${value[0].toUpperCase()}${value.slice(1)}`).join(" and ");

  return (
    <main className="wholesale-detail page-width">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/wholesale">Wholesale</Link><span>/</span><span>{item.name}</span></nav>
      <div className="product-detail__grid">
        <ProductGallery images={item.images} label="Wholesale package images" />
        <section className="product-info">
          <div className="product-info__badges"><span className="condition-badge">{item.conditionScope}</span>{item.promoEligible ? <span className="condition-badge condition-badge--promo">Promo</span> : null}{sold ? <span className="condition-badge condition-badge--sold">Sold</span> : null}</div>
          <p className="eyebrow">{audience} · {item.reference}</p><h1>{item.name}</h1><p className="product-info__price">{formatNaira(item.priceKobo)}</p>
          <p>{item.pieceCount} pieces · {item.categories.map((category) => category.name).join(", ")}</p><p className="product-info__description">{item.description}</p>
          <label>Package quantity<input aria-label="Package quantity" type="number" min="1" max={Math.max(1, item.stockQuantity)} value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={sold} /></label>
          <button className="button button--dark" type="button" disabled={sold} onClick={() => {
            upsertWholesaleCartLine({ itemType: "wholesale", packageId: item.id, reference: item.reference, name: item.name, quantity: resolvedQuantity, lastKnownPriceKobo: item.priceKobo, imageUrl: item.primaryImage?.url ?? null, selected: true });
            setAdded(true);
          }}>{sold ? "Sold out" : `Add ${resolvedQuantity} ${resolvedQuantity === 1 ? "package" : "packages"} to bag`}</button>
          {added ? <p role="status">Added to your bag. <Link to="/cart">View bag</Link></p> : null}
        </section>
      </div>
    </main>
  );
}
