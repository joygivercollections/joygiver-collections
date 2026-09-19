import { Link } from "react-router-dom";
import type { ProductSummary } from "../../shared/contracts";
import { formatNaira } from "../api";

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const sold = product.state === "sold";

  return (
    <article className="product-card">
      <Link className="product-card__image-link" to={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
        <div className="product-card__image-wrap">
          {product.primaryImage ? (
            <img
              className="product-card__image"
              src={product.primaryImage.url}
              alt={product.primaryImage.alt}
              loading="lazy"
            />
          ) : (
            <div className="product-card__placeholder" aria-hidden="true">
              <span>J</span>
            </div>
          )}
          <span className={`condition-badge condition-badge--${product.condition}`}>
            {product.condition === "new" ? "New" : "Thrifted"}
          </span>
          {sold ? <span className="sold-stamp">Sold</span> : null}
        </div>
      </Link>
      <div className="product-card__body">
        <div>
          <p className="eyebrow product-card__category">{product.category.name}</p>
          <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
        </div>
        <p className="product-card__price">{formatNaira(product.priceKobo)}</p>
      </div>
      <p className="product-card__meta">
        {product.reference} <span aria-hidden="true">·</span> Sizes {product.sizes.join(", ")}
      </p>
    </article>
  );
}
