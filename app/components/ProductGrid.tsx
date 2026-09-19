import type { ProductSummary } from "../../shared/contracts";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Nothing here yet</p>
        <h2>No pieces match those filters.</h2>
        <p>Try another category or clear a filter to see more of the collection.</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}
