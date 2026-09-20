import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductSummary } from "../../shared/contracts";
import { getProducts } from "../api";
import { ProductGrid } from "../components/ProductGrid";
import { RouteError } from "../components/RouteError";
import { storeConfig } from "../config";

export function HomePage() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getProducts({ sort: "latest", limit: 8 }, controller.signal)
      .then((result) => setProducts(result.items))
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true);
      });
    return () => controller.abort();
  }, [retryKey]);

  return (
    <>
      <section className="hero page-width">
        <div className="hero__copy">
          <p className="eyebrow">New pieces · Rare finds</p>
          <h1>Style that feels<br /><em>uniquely yours.</em></h1>
          <p className="hero__intro">Discover polished new arrivals and one-of-one thrifted treasures, handpicked for women who dress with intention.</p>
          <div className="hero__actions">
            <Link className="button button--dark" to="/new">Shop new</Link>
            <Link className="button button--light" to="/thrifted">Explore thrifted</Link>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <img data-testid="hero-brand-art" src={storeConfig.heroArtUrl} alt="" />
        </div>
      </section>

      <section className="latest-section page-width" aria-labelledby="latest-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Just in</p>
            <h2 id="latest-title">Latest arrivals</h2>
          </div>
          <Link className="text-link" to="/search">View all pieces <span aria-hidden="true">→</span></Link>
        </div>
        {error && !products ? <RouteError onRetry={() => setRetryKey((key) => key + 1)} /> : null}
        {!products && !error ? <ProductSkeleton count={8} /> : null}
        {products ? <ProductGrid products={products} /> : null}
      </section>

      <section className="collection-panels page-width" aria-label="Shop by condition">
        <Link to="/new" className="collection-panel collection-panel--new">
          <img className="collection-panel__image" data-testid="new-collection-image" src="/brand/new-edit.png" alt="" />
          <div>
            <p className="eyebrow">Fresh from the edit</p>
            <h2>Shop New</h2>
            <p>Contemporary silhouettes and wardrobe staples, ready for their first story.</p>
            <span className="text-link">Discover new <span aria-hidden="true">→</span></span>
          </div>
        </Link>
        <Link to="/thrifted" className="collection-panel collection-panel--thrifted">
          <img className="collection-panel__image" data-testid="thrifted-collection-image" src="/brand/thrifted-edit.png" alt="" />
          <div>
            <p className="eyebrow">One-of-one treasures</p>
            <h2>Shop Thrifted</h2>
            <p>Distinctive finds with character, carefully chosen and clearly described.</p>
            <span className="text-link">Find a treasure <span aria-hidden="true">→</span></span>
          </div>
        </Link>
      </section>

      <section className="how-it-works page-width" aria-labelledby="how-title">
        <div className="section-heading">
          <div><p className="eyebrow">Simple by design</p><h2 id="how-title">From cart to your wardrobe</h2></div>
        </div>
        <ol className="steps">
          <li><span>01</span><h3>Choose your pieces</h3><p>Add as many favourites as you like—no account needed.</p></li>
          <li><span>02</span><h3>Select what to order</h3><p>Tick only the cart items you want to send now.</p></li>
          <li><span>03</span><h3>Confirm on WhatsApp</h3><p>Your order details arrive pre-filled, ready to confirm delivery and payment.</p></li>
        </ol>
      </section>

      <section className="delivery-note">
        <div className="page-width delivery-note__inner">
          <p className="eyebrow">From Abuja, with care</p>
          <h2>Beautiful finds, delivered nationwide.</h2>
          <p>Pickup and local delivery within Abuja FCT, plus reliable delivery to every state in Nigeria.</p>
        </div>
      </section>
    </>
  );
}

function ProductSkeleton({ count }: { count: number }) {
  return <div className="product-grid" aria-label="Loading products">{Array.from({ length: count }, (_, index) => <div className="product-skeleton" key={index} />)}</div>;
}
