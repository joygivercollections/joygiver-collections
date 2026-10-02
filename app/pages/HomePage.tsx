import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductSummary, PromotionSummary, SiteSettings, WholesalePackageSummary } from "../../shared/contracts";
import { getActivePromotion, getProducts, getSiteSettings, getWholesalePackages } from "../api";
import { ProductGrid } from "../components/ProductGrid";
import { RouteError } from "../components/RouteError";
import { WholesaleCard } from "../components/WholesaleCard";
import { defaultSiteSettings } from "../config";

export function HomePage() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [promotion, setPromotion] = useState<PromotionSummary | null>(null);
  const [wholesale, setWholesale] = useState<WholesalePackageSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    Promise.all((["new", "thrifted"] as const).flatMap((condition) => (["women", "men", "kids"] as const).map((audience) =>
      getProducts({ sort: "latest", condition, audience, limit: 2 }, controller.signal),
    )))
      .then((results) => {
        const unique = new Map(results.flatMap((result) => result.items).map((item) => [item.id, item]));
        setProducts([...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 8));
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true);
      });
    return () => controller.abort();
  }, [retryKey]);

  useEffect(() => {
    const controller = new AbortController();
    getSiteSettings(controller.signal).then(setSettings).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getActivePromotion(controller.signal).then(setPromotion).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getWholesalePackages({ sort: "latest", availability: "available", limit: 3 }, controller.signal)
      .then((result) => setWholesale(result.items))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <>
      <section className="hero page-width">
        <div className="hero__copy">
          <p className="eyebrow">New pieces · Rare finds · Every generation</p>
          <h1>{settings.heroHeading}</h1>
          <p className="hero__intro">{settings.heroCopy}</p>
          <div className="hero__actions">
            <Link className="button button--dark" to="/new">Shop new</Link>
            <Link className="button button--light" to="/thrifted">Explore thrifted</Link>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <img data-testid="hero-brand-art" src={settings.heroUrl} alt="" />
        </div>
      </section>

      {promotion ? <section className="promotion-banner page-width" aria-label="Current offer">
        <div><p className="eyebrow">Limited-time offer</p><h2>{promotion.name}</h2><p>{promotion.description}</p></div>
        <p className="promotion-banner__rule"><strong>{promotion.discountBasisPoints / 100}% off</strong><span>every complete group of {promotion.requiredQuantity} eligible items</span></p>
      </section> : null}

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
        <article className="collection-panel collection-panel--new">
          <img className="collection-panel__image" data-testid="new-collection-image" src="/brand/new-edit.png" alt="" loading="lazy" decoding="async" />
          <div>
            <p className="eyebrow">Fresh from the edit</p>
            <h2>Shop New</h2>
            <p>Fresh clothing for women, men, and kids—ready for its first story.</p>
            <div className="audience-links" aria-label="Shop new by audience"><Link to="/new/women">Women</Link><Link to="/new/men">Men</Link><Link to="/new/kids">Kids</Link></div>
            <Link className="text-link" to="/new">Discover new <span aria-hidden="true">→</span></Link>
          </div>
        </article>
        <article className="collection-panel collection-panel--thrifted">
          <img className="collection-panel__image" data-testid="thrifted-collection-image" src="/brand/thrifted-edit.png" alt="" loading="lazy" decoding="async" />
          <div>
            <p className="eyebrow">One-of-one treasures</p>
            <h2>Shop Thrifted</h2>
            <p>Distinctive finds for the whole family, carefully chosen and clearly described.</p>
            <div className="audience-links" aria-label="Shop thrifted by audience"><Link to="/thrifted/women">Women</Link><Link to="/thrifted/men">Men</Link><Link to="/thrifted/kids">Kids</Link></div>
            <Link className="text-link" to="/thrifted">Find a treasure <span aria-hidden="true">→</span></Link>
          </div>
        </article>
      </section>

      <section className="wholesale-feature page-width" aria-labelledby="wholesale-feature-title">
        <div className="section-heading"><div><p className="eyebrow">More pieces, one package</p><h2 id="wholesale-feature-title">Wholesale edits</h2><p>See the package image, clothing types, piece count, and total price at a glance.</p></div><Link className="text-link" to="/wholesale">Explore wholesale <span aria-hidden="true">→</span></Link></div>
        {wholesale.length ? <div className="wholesale-grid wholesale-grid--featured">{wholesale.map((item) => <WholesaleCard key={item.id} item={item} />)}</div> : <div className="wholesale-feature__empty"><p>Curated wholesale packages are added as soon as each edit is ready.</p><Link className="button button--light" to="/wholesale">View wholesale</Link></div>}
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
