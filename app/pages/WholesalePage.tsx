import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Audience, CategorySummary, WholesaleConditionScope, WholesalePackageSummary } from "../../shared/contracts";
import { getCategories, getWholesalePackages } from "../api";
import { WholesaleCard } from "../components/WholesaleCard";
import { RouteError } from "../components/RouteError";

export function WholesalePage() {
  const [items, setItems] = useState<WholesalePackageSummary[] | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<Audience | "">("");
  const [condition, setCondition] = useState<WholesaleConditionScope | "">("");
  const [category, setCategory] = useState("");
  const [minPieces, setMinPieces] = useState("");
  const [maxPieces, setMaxPieces] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availability, setAvailability] = useState<"available" | "sold" | "">("");
  const [sort, setSort] = useState<"latest" | "price-asc" | "price-desc">("latest");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const filters = useMemo(() => ({
    audience: audience || undefined,
    condition: condition || undefined,
    category: category || undefined,
    minPieceCount: minPieces ? Number(minPieces) : undefined,
    maxPieceCount: maxPieces ? Number(maxPieces) : undefined,
    minPriceKobo: minPrice ? Math.round(Number(minPrice) * 100) : undefined,
    maxPriceKobo: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
    availability: availability || undefined,
    search: query || undefined,
    sort,
    page: 1,
    limit: 24,
  }), [audience, availability, category, condition, maxPieces, maxPrice, minPieces, minPrice, query, sort]);

  useEffect(() => {
    const controller = new AbortController();
    getCategories(undefined, controller.signal).then(setCategories).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getWholesalePackages(filters, controller.signal).then((result) => setItems(result.items)).catch((caught: unknown) => {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true);
    });
    return () => controller.abort();
  }, [filters, retry]);

  function submit(event: FormEvent) { event.preventDefault(); setQuery(search.trim()); }

  return (
    <main className="wholesale-page page-width">
      <header className="catalogue__header"><p className="eyebrow">Buy in quantity</p><h1>Wholesale Packages</h1><p>See the package photo, clothing types, piece count, and total price—without browsing every garment inside.</p></header>
      <form className="wholesale-filters" role="search" onSubmit={submit}>
        <label>Search packages<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value as Audience | "")}><option value="">All audiences</option><option value="women">Women</option><option value="men">Men</option><option value="kids">Kids</option></select></label>
        <label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value as WholesaleConditionScope | "")}><option value="">All conditions</option><option value="new">New</option><option value="thrifted">Thrifted</option><option value="mixed">Mixed</option></select></label>
        <label>Clothing type<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All types</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <label>Minimum pieces<input type="number" min="1" value={minPieces} onChange={(event) => setMinPieces(event.target.value)} /></label>
        <label>Maximum pieces<input type="number" min="1" value={maxPieces} onChange={(event) => setMaxPieces(event.target.value)} /></label>
        <label>Minimum price (₦)<input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
        <label>Maximum price (₦)<input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
        <label>Availability<select value={availability} onChange={(event) => setAvailability(event.target.value as "available" | "sold" | "")}><option value="">Available and recent sold</option><option value="available">Available</option><option value="sold">Sold</option></select></label>
        <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="latest">Latest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
        <button className="button button--dark" type="submit">Search</button>
      </form>
      {error ? <RouteError onRetry={() => setRetry((value) => value + 1)} /> : null}
      {!items && !error ? <p>Loading wholesale packages…</p> : null}
      {items ? <section className="wholesale-grid" aria-label="Wholesale packages">{items.map((item) => <WholesaleCard key={item.id} item={item} />)}{items.length === 0 ? <p>No wholesale packages match these filters.</p> : null}</section> : null}
    </main>
  );
}
