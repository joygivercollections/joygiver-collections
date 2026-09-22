import { useState } from "react";
import { Link } from "react-router-dom";
import type { WholesalePackageSummary } from "../../shared/contracts";
import { formatNaira } from "../api";
import { upsertWholesaleCartLine } from "../cart/cart-store";

function audienceLabel(values: WholesalePackageSummary["audiences"]) {
  return values.map((value) => value === "kids" ? "Kids" : `${value[0].toUpperCase()}${value.slice(1)}`).join(" and ");
}

export function WholesaleCard({ item }: { item: WholesalePackageSummary }) {
  const [added, setAdded] = useState(false);
  const sold = item.state === "sold" || item.stockQuantity <= 0;
  return (
    <article className="wholesale-card">
      <Link to={`/wholesale/${item.slug}`} aria-label={`View ${item.name}`}>
        <div className="wholesale-card__image">{item.primaryImage ? <img src={item.primaryImage.url} alt={item.primaryImage.alt} loading="lazy" /> : <span aria-hidden="true">J</span>}{sold ? <span className="sold-stamp">Sold</span> : null}{item.promoEligible ? <span className="condition-badge condition-badge--promo">Promo</span> : null}</div>
      </Link>
      <div className="wholesale-card__body">
        <p className="eyebrow">{audienceLabel(item.audiences)} · {item.conditionScope[0].toUpperCase()}{item.conditionScope.slice(1)}</p>
        <h2><Link to={`/wholesale/${item.slug}`}>{item.name}</Link></h2>
        <p>{item.categories.map((category) => category.name).join(", ")}</p>
        <div><strong>{item.pieceCount} pieces</strong><strong>{formatNaira(item.priceKobo)}</strong></div>
        <p>{sold ? "Sold" : `${item.stockQuantity} ${item.stockQuantity === 1 ? "package" : "packages"} available`}</p>
        <button className="button button--dark" type="button" disabled={sold} onClick={() => {
          upsertWholesaleCartLine({ itemType: "wholesale", packageId: item.id, reference: item.reference, name: item.name, quantity: 1, lastKnownPriceKobo: item.priceKobo, imageUrl: item.primaryImage?.url ?? null, selected: true });
          setAdded(true);
        }}>{sold ? "Sold out" : "Add package to bag"}</button>
        {added ? <p role="status">Added to your bag.</p> : null}
      </div>
    </article>
  );
}
