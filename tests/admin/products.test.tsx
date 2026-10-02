import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { AdminProduct } from "../../shared/contracts";
import { ProductsPage } from "../../app/admin/ProductsPage";

const product: AdminProduct = {
  id: "p1", reference: "JGC-A1B2C3D4", slug: "champagne-skirt", name: "Champagne Maxi Skirt", description: "Elegant flow", priceKobo: 24_000_00,
  condition: "new", category: { id: "maxi", name: "Maxi Skirts", slug: "maxi-skirts" }, audiences: ["women"], isUnisex: false, sizes: ["M"], tags: ["elegant"], stockQuantity: 2,
  state: "available", soldAt: null, primaryImage: null, images: [], featured: false, published: true, publishedAt: new Date().toISOString(),
};

it("requires the exact reference before deleting a product", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [product], page: 1, pageSize: 24, total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } })));
  const user = userEvent.setup();
  render(<MemoryRouter><ProductsPage /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: /delete champagne maxi skirt/i }));
  expect(screen.getByRole("button", { name: /delete permanently/i })).toBeDisabled();
  await user.type(screen.getByLabelText(/type product reference/i), "JGC-A1B2C3D4");
  expect(screen.getByRole("button", { name: /delete permanently/i })).toBeEnabled();
});

it("loads later inventory pages and reports the displayed range", async () => {
  const fetchMock = vi.fn(async (input) => {
    const page = String(input).includes("page=2") ? 2 : 1;
    return new Response(JSON.stringify({ items: [{ ...product, id: `p${page}`, name: `Product page ${page}` }], page, pageSize: 24, total: 25 }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><ProductsPage /></MemoryRouter>);

  expect(await screen.findByText("1–24 of 25 products")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Product page 2")).toBeVisible();
  expect(screen.getByText("25–25 of 25 products")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.anything());
});
