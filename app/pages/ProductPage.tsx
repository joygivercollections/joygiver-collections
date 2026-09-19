import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Product } from "../../shared/contracts";
import { formatNaira, getProduct } from "../api";
import { RouteError } from "../components/RouteError";

export function ProductPage() {
  const { slug = "" } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getProduct(slug, controller.signal)
      .then((result) => {
        setProduct(result);
        setSelectedSize(result.sizes.length === 1 ? result.sizes[0] : "");
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true);
      });
    return () => controller.abort();
  }, [slug, retryKey]);

  if (error && !product) return <div className="page-width product-route-error"><RouteError title="This piece is unavailable" message="It may have sold or moved out of the current collection." onRetry={() => setRetryKey((key) => key + 1)} /></div>;
  if (!product) return <div className="page-width product-detail product-detail--loading" aria-label="Loading product" />;

  const sold = product.state === "sold";
  return (
    <div className="product-detail page-width">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span aria-hidden="true">/</span>
        <Link to={`/${product.condition}`}>{product.condition === "new" ? "New" : "Thrifted"}</Link><span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail__grid">
        <div className="product-gallery">
          {product.images.length ? product.images.map((image) => (
            <img key={image.id} src={image.url} alt={image.alt} />
          )) : <div className="product-gallery__placeholder"><span aria-hidden="true">J</span></div>}
        </div>
        <section className="product-info">
          <div className="product-info__badges">
            <span className={`condition-badge condition-badge--${product.condition}`}>{product.condition === "new" ? "New" : "Thrifted"}</span>
            {sold ? <span className="condition-badge condition-badge--sold">Sold</span> : null}
          </div>
          <p className="eyebrow">{product.category.name} · {product.reference}</p>
          <h1>{product.name}</h1>
          <p className="product-info__price">{formatNaira(product.priceKobo)}</p>
          <p className="product-info__description">{product.description}</p>
          <fieldset className="product-size" disabled={sold}>
            <legend>Select a size</legend>
            <div className="size-choices">
              {product.sizes.map((size) => <label key={size}><input type="radio" name="product-size" value={size} checked={selectedSize === size} onChange={() => setSelectedSize(size)} /><span>{size}</span></label>)}
            </div>
          </fieldset>
          {product.condition === "thrifted" ? <div className="condition-note"><strong>Condition note</strong><p>Every thrifted piece is carefully checked. Please review the photos and description for its individual character.</p></div> : null}
          <button className="button button--dark product-info__add" type="button" disabled={sold || !selectedSize}>
            {sold ? "Sold out" : selectedSize ? "Add to bag" : "Select a size"}
          </button>
          <div className="product-assurances">
            <p><span aria-hidden="true">◇</span> Abuja based</p>
            <p><span aria-hidden="true">◇</span> Nationwide delivery</p>
            <p><span aria-hidden="true">◇</span> Order confirmed on WhatsApp</p>
          </div>
          {product.tags.length ? <p className="product-tags">{product.tags.map((tag) => <span key={tag}>#{tag}</span>)}</p> : null}
        </section>
      </div>
    </div>
  );
}
