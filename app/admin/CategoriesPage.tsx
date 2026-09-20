import { FormEvent, useEffect, useState } from "react";
import type { AdminCategory } from "../../shared/contracts";
import { ApiRequestError, ownerApi } from "../api";

export function CategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { ownerApi.categories().then(setCategories).catch(() => setNotice("Categories could not be loaded.")); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const category = await ownerApi.createCategory({ name: name.trim(), displayOrder: categories.length + 1, active: true });
    setCategories((items) => [...items, category]);
    setName("");
    setNotice(`${category.name} was added.`);
  }

  async function save(category: AdminCategory) {
    const updated = await ownerApi.updateCategory(category.id, { name: category.name, displayOrder: category.displayOrder, active: category.active });
    setCategories((items) => items.map((item) => item.id === updated.id ? updated : item));
    setNotice(`${updated.name} was updated.`);
  }

  async function retire(category: AdminCategory) {
    try {
      await ownerApi.retireCategory(category.id);
      setCategories((items) => items.map((item) => item.id === category.id ? { ...item, active: false } : item));
      setNotice(`${category.name} was retired.`);
    } catch (caught) {
      const productCount = caught instanceof ApiRequestError ? caught.productCount : undefined;
      setNotice(productCount ? `${productCount} products must be reassigned before ${category.name} can be retired.` : `Products must be reassigned before ${category.name} can be retired.`);
    }
  }

  return <main className="admin-content"><header className="admin-page-head"><div><p className="eyebrow">Store organisation</p><h1>Categories</h1><p>These options help customers filter New and Thrifted collections.</p></div></header>{notice ? <p className="admin-notice" role="status">{notice}</p> : null}<form className="category-create" onSubmit={create}><label>New category name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Blazers" /></label><button className="button button--dark" type="submit">Add category</button></form><section className="category-list" aria-label="Categories">{categories.map((category, index) => <article key={category.id}><span className="category-list__order">{String(index + 1).padStart(2, "0")}</span><label>Category name<input value={category.name} onChange={(event) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item))} /></label><label>Display order<input type="number" min="0" value={category.displayOrder} onChange={(event) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, displayOrder: Number(event.target.value) } : item))} /></label><span className={`status status--${category.active ? "available" : "hidden"}`}>{category.active ? "active" : "retired"}</span><button type="button" onClick={() => save(category)}>Save</button>{category.active ? <button className="danger-link" type="button" onClick={() => retire(category)}>Retire</button> : null}</article>)}</section></main>;
}
