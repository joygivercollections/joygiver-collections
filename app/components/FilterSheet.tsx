import { FormEvent, useEffect, useState } from "react";
import type { CategorySummary, CatalogueFilters } from "../../shared/contracts";

interface FilterSheetProps {
  open: boolean;
  categories: CategorySummary[];
  current: CatalogueFilters;
  onClose: () => void;
  onApply: (filters: CatalogueFilters) => void;
}

const sizes = ["XS", "S", "M", "L", "XL", "One size"];

export function FilterSheet({ open, categories, current, onClose, onApply }: FilterSheetProps) {
  const [category, setCategory] = useState(current.category ?? "");
  const [size, setSize] = useState(current.size ?? "");
  const [sort, setSort] = useState<CatalogueFilters["sort"]>(current.sort ?? "latest");
  const [minPrice, setMinPrice] = useState(current.minPriceKobo ? String(current.minPriceKobo / 100) : "");
  const [maxPrice, setMaxPrice] = useState(current.maxPriceKobo ? String(current.maxPriceKobo / 100) : "");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    onApply({
      ...current,
      category: category || undefined,
      size: size || undefined,
      sort,
      minPriceKobo: minPrice ? Math.round(Number(minPrice) * 100) : undefined,
      maxPriceKobo: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
      page: 1,
    });
  }

  function clear() {
    setCategory("");
    setSize("");
    setSort("latest");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <div className="filter-overlay" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
        <div className="filter-sheet__head">
          <div>
            <p className="eyebrow">Refine your edit</p>
            <h2 id="filter-title">Filter products</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close filters">×</button>
        </div>
        <form onSubmit={submit}>
          <fieldset>
            <legend>Category</legend>
            <div className="choice-list">
              {categories.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    name="category"
                    value={item.slug}
                    checked={category === item.slug}
                    onChange={() => setCategory(category === item.slug ? "" : item.slug)}
                  />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Size</legend>
            <div className="size-choices">
              {sizes.map((item) => (
                <label key={item}>
                  <input type="radio" name="size" value={item} checked={size === item} onChange={() => setSize(item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Price range (₦)</legend>
            <div className="price-fields">
              <label>Minimum<input inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
              <span aria-hidden="true">—</span>
              <label>Maximum<input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
            </div>
          </fieldset>
          <label className="select-field">
            Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value as CatalogueFilters["sort"])}>
              <option value="latest">Latest arrivals</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
          <div className="filter-sheet__actions">
            <button className="button button--text" type="button" onClick={clear}>Clear all</button>
            <button className="button button--dark" type="submit">Apply filters</button>
          </div>
        </form>
      </section>
    </div>
  );
}
