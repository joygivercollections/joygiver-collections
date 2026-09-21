import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PromotionForm } from "../../app/admin/PromotionForm";
import { PromotionsPage } from "../../app/admin/PromotionsPage";

const retail = { id: "product-1", name: "Ivory Gown", reference: "JGC-1", category: { id: "gowns", name: "Gowns", slug: "gowns" }, audiences: ["women"], isUnisex: false, condition: "new", priceKobo: 20_000_00, sizes: ["M"], tags: [], stockQuantity: 1, state: "available", soldAt: null, primaryImage: null, description: "Gown", featured: false, published: true, publishedAt: "2026-09-21T10:00:00.000Z", images: [] };
const wholesale = { id: "package-1", name: "Denim Bale", reference: "JGC-W-1", slug: "denim-bale", description: "Denim", audiences: ["women"], conditionScope: "mixed", categories: [{ id: "jeans", name: "Jeans", slug: "jeans" }], pieceCount: 24, priceKobo: 100_000_00, stockQuantity: 2, state: "available", soldAt: null, featured: false, published: true, publishedAt: "2026-09-21T10:00:00.000Z", primaryImage: null, images: [] };

it("serializes Lagos time, percentage, preview, and selected eligibility", async () => {
  const fetchMock = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/admin/products")) return new Response(JSON.stringify({ items: [retail], page: 1, pageSize: 24, total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/admin/wholesale")) return new Response(JSON.stringify({ items: [wholesale], page: 1, pageSize: 24, total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/api/admin/promotions") && init?.method === "POST") return new Response(JSON.stringify({ id: "promo-1" }), { status: 201, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><PromotionForm /></MemoryRouter>);
  await user.type(screen.getByLabelText(/promotion name/i), "Six-piece edit");
  await user.clear(screen.getByLabelText(/eligible quantity/i)); await user.type(screen.getByLabelText(/eligible quantity/i), "6");
  await user.clear(screen.getByLabelText(/discount percentage/i)); await user.type(screen.getByLabelText(/discount percentage/i), "15");
  fireEvent.change(screen.getByLabelText(/starts/i), { target: { value: "2026-09-21T11:00" } });
  fireEvent.change(screen.getByLabelText(/ends/i), { target: { value: "2026-09-30T11:00" } });
  await user.click(await screen.findByLabelText(/ivory gown/i));
  await user.click(screen.getByLabelText(/denim bale/i));
  expect(screen.getByText(/every complete group of 6 eligible cart items receives 15% off/i)).toBeVisible();
  await user.click(screen.getByRole("button", { name: /save promotion/i }));
  const body = String(fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/admin/promotions") && init?.method === "POST")?.[1]?.body);
  expect(body).toContain('"discountBasisPoints":1500');
  expect(body).toContain('"startAt":"2026-09-21T10:00:00.000Z"');
  expect(body).toContain('"productIds":["product-1"]');
  expect(body).toContain('"wholesalePackageIds":["package-1"]');
});

it("pauses a promotion without changing its schedule", async () => {
  const promotion = { id: "promo-1", name: "Six-piece edit", description: "", requiredQuantity: 6, discountBasisPoints: 1500, startAt: "2026-09-21T10:00:00.000Z", endAt: "2026-09-30T10:00:00.000Z", paused: false, productIds: [], wholesalePackageIds: [], createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z" };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([promotion]), { status: 200, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...promotion, paused: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><PromotionsPage /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: /pause/i }));
  expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/promotions/promo-1", expect.objectContaining({ body: expect.stringContaining('"startAt":"2026-09-21T10:00:00.000Z"') }));
  expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('"paused":true');
});
