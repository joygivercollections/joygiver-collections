import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { WholesaleDetailPage } from "../../app/pages/WholesaleDetailPage";
import { WholesalePage } from "../../app/pages/WholesalePage";
import { loadCart } from "../../app/cart/cart-store";

const packageItem = {
  id: "wholesale-1", reference: "JGC-W-1234ABCD", slug: "family-denim-bale", name: "Family Denim Bale",
  description: "A photographed package of assorted denim pieces.", audiences: ["women", "men"], conditionScope: "mixed",
  categories: [
    { id: "shirts", name: "Shirts", slug: "shirts" },
    { id: "gowns", name: "Gowns", slug: "gowns" },
    { id: "tops", name: "Tops", slug: "tops" },
  ], pieceCount: 24, priceKobo: 18_000_000,
  stockQuantity: 3, state: "available", soldAt: null, featured: true,
  primaryImage: { url: "/media/wholesale/package.jpg", alt: "Denim wholesale package" },
  images: [{ id: "image-1", url: "/media/wholesale/package.jpg", alt: "Denim wholesale package", displayOrder: 0 }],
  publishedAt: "2026-09-21T10:00:00.000Z", promoEligible: true,
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/api/wholesale/family-denim-bale")) return new Response(JSON.stringify(packageItem), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/wholesale")) return new Response(JSON.stringify({ items: [packageItem], page: 1, pageSize: 24, total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/categories")) return new Response(JSON.stringify(packageItem.categories), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  }));
});

it("shows owner-defined package details without shopper filters", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><WholesalePage /></MemoryRouter>);
  const card = await screen.findByRole("article");
  expect(card).toHaveTextContent("Mixed audience");
  expect(card).toHaveTextContent("Mixed condition");
  expect(card).toHaveTextContent("Shirts, Gowns & Tops");
  expect(card).toHaveTextContent("24 pieces");
  expect(card).toHaveTextContent("₦180,000");
  expect(card).toHaveTextContent("Promo");
  expect(card).not.toHaveTextContent(/size/i);
  expect(screen.queryByRole("search")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /add package to bag/i }));
  expect(loadCart()).toEqual([expect.objectContaining({ itemType: "wholesale", packageId: "wholesale-1", quantity: 1 })]);
});

it("adds quantity two as one selected wholesale cart line", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/wholesale/family-denim-bale"]}><Routes><Route path="/wholesale/:slug" element={<WholesaleDetailPage />} /></Routes></MemoryRouter>);
  await screen.findByRole("heading", { name: "Family Denim Bale" });
  expect(screen.getByText(/mixed audience/i)).toBeVisible();
  expect(screen.getByText(/mixed condition/i)).toBeVisible();
  expect(screen.getByText(/shirts, gowns & tops/i)).toBeVisible();
  await user.clear(screen.getByLabelText(/package quantity/i));
  await user.type(screen.getByLabelText(/package quantity/i), "2");
  await user.click(screen.getByRole("button", { name: /add 2 packages to bag/i }));

  expect(loadCart()).toEqual([expect.objectContaining({ itemType: "wholesale", packageId: "wholesale-1", quantity: 2, selected: true })]);
});

it("loads wholesale packages beyond the first page", async () => {
  const fetchMock = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/api/categories")) return new Response(JSON.stringify(packageItem.categories), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/wholesale")) {
      const page = url.includes("page=2") ? 2 : 1;
      return new Response(JSON.stringify({ items: [{ ...packageItem, id: `package-${page}`, name: `Package page ${page}` }], page, pageSize: 24, total: 25 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><WholesalePage /></MemoryRouter>);

  expect(await screen.findByText("1–24 of 25 packages")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("heading", { name: "Package page 2" })).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.anything());
});

it("shows a simple empty state when no packages are available", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    const body = String(input).includes("/api/categories") ? [] : { items: [], page: 1, pageSize: 24, total: 0 };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
  render(<MemoryRouter><WholesalePage /></MemoryRouter>);
  expect(await screen.findByText(/no wholesale packages are available yet/i)).toBeVisible();
});
