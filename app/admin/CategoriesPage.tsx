import { FormEvent, useEffect, useState } from "react";
import type { AdminCategory, Audience } from "../../shared/contracts";
import { ApiRequestError, ownerApi } from "../api";

const audienceOptions: Array<{ value: Audience; label: string }> = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "kids", label: "Kids" },
];

export function CategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [name, setName] = useState("");
  const [newAudiences, setNewAudiences] = useState<Audience[]>(["women"]);
  const [notice, setNotice] = useState("");

  useEffect(() => { ownerApi.categories().then(setCategories).catch(() => setNotice("Clothing types could not be loaded.")); }, []);

  function toggleCategoryAudience(categoryId: string, audience: Audience) {
    setCategories((items) => items.map((item) => item.id !== categoryId ? item : {
      ...item,
      audiences: item.audiences.includes(audience) ? item.audiences.filter((value) => value !== audience) : [...item.audiences, audience],
    }));
  }

  function toggleNewAudience(audience: Audience) {
    setNewAudiences((items) => items.includes(audience) ? items.filter((value) => value !== audience) : [...items, audience]);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || newAudiences.length === 0) {
      setNotice("Enter a name and choose at least one audience.");
      return;
    }
    try {
      const category = await ownerApi.createCategory({ name: name.trim(), displayOrder: categories.length + 1, active: true, audiences: newAudiences });
      setCategories((items) => [...items, category]);
      setName("");
      setNewAudiences(["women"]);
      setNotice(`${category.name} was added.`);
    } catch (caught) {
      setNotice(caught instanceof ApiRequestError ? caught.message : "The clothing type could not be added.");
    }
  }

  async function save(category: AdminCategory) {
    if (category.audiences.length === 0) {
      setNotice(`${category.name} must belong to at least one audience.`);
      return;
    }
    try {
      const updated = await ownerApi.updateCategory(category.id, {
        name: category.name,
        displayOrder: category.displayOrder,
        active: category.active,
        audiences: category.audiences,
      });
      setCategories((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${updated.name} was updated.`);
    } catch (caught) {
      setNotice(caught instanceof ApiRequestError ? caught.message : `${category.name} could not be updated.`);
    }
  }

  async function retire(category: AdminCategory) {
    try {
      await ownerApi.retireCategory(category.id);
      setCategories((items) => items.map((item) => item.id === category.id ? { ...item, active: false } : item));
      setNotice(`${category.name} was retired.`);
    } catch (caught) {
      const productCount = caught instanceof ApiRequestError ? caught.productCount : undefined;
      const wholesaleCount = caught instanceof ApiRequestError ? caught.wholesaleCount : undefined;
      const dependencies = [productCount ? `${productCount} retail products` : "", wholesaleCount ? `${wholesaleCount} wholesale packages` : ""].filter(Boolean).join(" and ");
      setNotice(dependencies ? `${dependencies} must be reassigned before ${category.name} can be retired.` : `Inventory must be reassigned before ${category.name} can be retired.`);
    }
  }

  return (
    <main className="admin-content">
      <header className="admin-page-head"><div><p className="eyebrow">Store organisation</p><h1>Clothing Types</h1><p>Assign each clothing type to Women, Men, Kids, or any combination.</p></div></header>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <form className="category-create" onSubmit={create}>
        <label>New clothing type name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Blazers" /></label>
        <fieldset><legend>Available for</legend>{audienceOptions.map(({ value, label }) => <label key={value}><input type="checkbox" checked={newAudiences.includes(value)} onChange={() => toggleNewAudience(value)} />{label}</label>)}</fieldset>
        <button className="button button--dark" type="submit">Add clothing type</button>
      </form>
      <section className="category-list" aria-label="Clothing Types">
        {categories.map((category, index) => (
          <article key={category.id}>
            <span className="category-list__order">{String(index + 1).padStart(2, "0")}</span>
            <label>Clothing type name<input value={category.name} onChange={(event) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item))} /></label>
            <label>Display order<input type="number" min="0" value={category.displayOrder} onChange={(event) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, displayOrder: Number(event.target.value) } : item))} /></label>
            <fieldset><legend>Audiences</legend>{audienceOptions.map(({ value, label }) => <label key={value}><input type="checkbox" aria-label={`${label} for ${category.name}`} checked={category.audiences.includes(value)} onChange={() => toggleCategoryAudience(category.id, value)} />{label}</label>)}</fieldset>
            <span className={`status status--${category.active ? "available" : "hidden"}`}>{category.active ? "active" : "retired"}</span>
            <button type="button" aria-label={`Save ${category.name}`} onClick={() => save(category)}>Save</button>
            {category.active ? <button className="danger-link" type="button" onClick={() => retire(category)}>Retire</button> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
