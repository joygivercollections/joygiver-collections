import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { CategorySummary, CatalogueFilters, ProductCondition, ProductSummary } from "../../shared/contracts";
import { buildProductQuery, getCategories, getProducts } from "../api";
import { FilterSheet } from "../components/FilterSheet";
import { ProductGrid } from "../components/ProductGrid";
import { RouteError } from "../components/RouteError";

function fromSearchParams(params: URLSearchParams, condition?: ProductCondition): CatalogueFilters {
  const page = Number(params.get("page") || "1");
  return {
    condition,
    category: params.get("category") || undefined,
    size: params.get("size") || undefined,
    search: params.get("search") || undefined,
    sort: (params.get("sort") as CatalogueFilters["sort"]) || "latest",
    minPriceKobo: params.has("minPriceKobo") ? Number(params.get("minPriceKobo")) : undefined,
    maxPriceKobo: params.has("maxPriceKobo") ? Number(params.get("maxPriceKobo")) : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: 24,
  };
}

export function CataloguePage({ condition }: { condition?: ProductCondition }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const filters = useMemo(() => fromSearchParams(searchParams, condition), [searchParams, condition]);
  const requestKey = buildProductQuery(filters);

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal).then(setCategories).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getProducts(filters, controller.signal)
      .then((result) => {
        setProducts(result.items);
        setTotal(result.total);
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true);
      });
    return () => controller.abort();
    // requestKey captures all URL-backed filters without re-fetching for object identity.
  }, [requestKey, retryKey]);

  const applyFilters = useCallback((next: CatalogueFilters) => {
    const query = new URLSearchParams();
    if (next.category) query.set("category", next.category);
    if (next.size) query.set("size", next.size);
    if (next.search) query.set("search", next.search);
    if (next.sort && next.sort !== "latest") query.set("sort", next.sort);
    if (next.minPriceKobo !== undefined) query.set("minPriceKobo", String(next.minPriceKobo));
    if (next.maxPriceKobo !== undefined) query.set("maxPriceKobo", String(next.maxPriceKobo));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    window.history.replaceState({}, "", `${location.pathname}${suffix}`);
    setSearchParams(query, { replace: true });
    setFilterOpen(false);
  }, [location.pathname, setSearchParams]);

  const heading = condition === "new" ? "The New Collection" : condition === "thrifted" ? "Thrifted Treasures" : "The Full Collection";
  const intro = condition === "new"
    ? "Fresh silhouettes and considered staples, selected for effortless everyday polish."
    : condition === "thrifted"
      ? "One-of-one fashion with a past and plenty of story left to tell."
      : "Explore every new arrival and one-of-one thrifted find in one considered edit.";
  const activeFilterCount = [filters.category, filters.size, filters.minPriceKobo, filters.maxPriceKobo].filter(Boolean).length;

  return (
    <div className="catalogue page-width">
      <header className="catalogue__header">
        <p className="eyebrow">Joygiver edit</p>
        <h1>{heading}</h1>
        <p>{intro}</p>
      </header>
      {filters.search ? <p className="search-summary">Showing results for <strong>“{filters.search}”</strong></p> : null}
      <div className="catalogue__toolbar">
        <p>{products ? `${total} ${total === 1 ? "piece" : "pieces"}` : "Loading the edit…"}</p>
        <button className="filter-button" type="button" onClick={() => setFilterOpen(true)}>
          <span aria-hidden="true">☷</span> Filter products {activeFilterCount ? <b>{activeFilterCount}</b> : null}
        </button>
      </div>
      {error ? <RouteError onRetry={() => setRetryKey((key) => key + 1)} /> : null}
      {!products && !error ? <div className="product-grid">{Array.from({ length: 8 }, (_, index) => <div className="product-skeleton" key={index} />)}</div> : null}
      {products ? <ProductGrid products={products} /> : null}
      <FilterSheet open={filterOpen} categories={categories} current={filters} onClose={() => setFilterOpen(false)} onApply={applyFilters} />
    </div>
  );
}
