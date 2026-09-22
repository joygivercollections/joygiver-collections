import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { WholesaleForm } from "../../app/admin/WholesaleForm";
import { WholesalePage } from "../../app/admin/WholesalePage";

const packageItem = {
  id: "wholesale-1", reference: "JGC-W-1234ABCD", slug: "family-denim-bale", name: "Family Denim Bale",
  description: "A photographed package of assorted denim pieces.", audiences: ["women", "men"], conditionScope: "mixed",
  categories: [{ id: "cat-jeans", name: "Jeans", slug: "jeans" }], pieceCount: 24, priceKobo: 18_000_000,
  stockQuantity: 3, state: "available", soldAt: null, featured: true, published: true,
  primaryImage: null, images: [], publishedAt: "2026-09-21T10:00:00.000Z",
};

it("preserves package fields when a representative image upload fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/admin/categories")) return new Response(JSON.stringify([{ id: "cat-jeans", name: "Jeans", slug: "jeans", active: true, displayOrder: 1, audiences: ["women"] }]), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/api/admin/wholesale") && init?.method === "POST") return new Response(JSON.stringify({ ...packageItem, audiences: ["women"] }), { status: 201, headers: { "Content-Type": "application/json" } });
    if (url.includes("/images")) return new Response(JSON.stringify({ status: 503, code: "image_storage_unavailable", message: "Try again" }), { status: 503, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter><WholesaleForm /></MemoryRouter>);
  await user.type(screen.getByLabelText(/package name/i), "Family Denim Bale");
  await user.type(screen.getByLabelText(/^description/i), "A photographed package of assorted denim pieces.");
  await user.click(screen.getByLabelText("Women"));
  await user.click(await screen.findByLabelText("Jeans"));
  await user.type(screen.getByLabelText(/piece count/i), "24");
  await user.type(screen.getByLabelText(/price in naira/i), "180000");
  await user.upload(screen.getByLabelText(/package images/i), new File([new Uint8Array([0xff, 0xd8, 0xff])], "bale.jpg", { type: "image/jpeg" }));
  await user.click(screen.getByRole("button", { name: /save package/i }));

  expect(await screen.findByText(/bale.jpg could not be uploaded/i)).toBeVisible();
  expect(screen.getByLabelText(/package name/i)).toHaveValue("Family Denim Bale");
  expect(screen.getByLabelText(/piece count/i)).toHaveValue(24);
});

it("supports sold, restore, hide, and exact-reference deletion controls", async () => {
  const fetchMock = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/admin/wholesale/wholesale-1/state")) {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ...packageItem, state: body.state }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/api/admin/wholesale/wholesale-1") && init?.method === "DELETE") return new Response(null, { status: 204 });
    if (url.includes("/api/admin/wholesale")) return new Response(JSON.stringify({ items: [packageItem], page: 1, pageSize: 24, total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><WholesalePage /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: /mark sold/i }));
  expect(await screen.findByRole("button", { name: /restore/i })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /restore/i }));
  await user.click(screen.getByRole("button", { name: /hide/i }));
  await user.click(screen.getByRole("button", { name: /delete family denim bale/i }));
  expect(screen.getByRole("button", { name: /delete permanently/i })).toBeDisabled();
  await user.type(screen.getByLabelText(/type package reference/i), "JGC-W-1234ABCD");
  await user.click(screen.getByRole("button", { name: /delete permanently/i }));
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/wholesale/wholesale-1", expect.objectContaining({ method: "DELETE", body: expect.stringContaining("JGC-W-1234ABCD") }));
});

it("loads later wholesale inventory pages", async () => {
  const fetchMock = vi.fn(async (input) => {
    const page = String(input).includes("page=2") ? 2 : 1;
    return new Response(JSON.stringify({ items: [{ ...packageItem, id: `package-${page}`, name: `Wholesale page ${page}` }], page, pageSize: 24, total: 25 }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><WholesalePage /></MemoryRouter>);

  expect(await screen.findByText("1–24 of 25 packages")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Wholesale page 2")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.anything());
});

it("removes and reorders representative package images", async () => {
  const images = [
    { id: "11111111-1111-4111-8111-111111111111", url: "/media/one.jpg", alt: "Front", displayOrder: 0 },
    { id: "22222222-2222-4222-8222-222222222222", url: "/media/two.jpg", alt: "Back", displayOrder: 1 },
  ];
  const fetchMock = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/admin/categories")) return new Response(JSON.stringify([{ id: "cat-jeans", name: "Jeans", slug: "jeans", active: true, displayOrder: 1, audiences: ["women", "men"] }]), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/images/order") && init?.method === "PUT") return new Response(JSON.stringify({ images: [...images].reverse().map((image, index) => ({ ...image, displayOrder: index })) }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/images/") && init?.method === "DELETE") return new Response(null, { status: 204 });
    if (url.endsWith("/api/admin/wholesale/wholesale-1")) return new Response(JSON.stringify({ ...packageItem, images, primaryImage: images[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/owner/wholesale/wholesale-1"]}><Routes><Route path="/owner/wholesale/:id" element={<WholesaleForm />} /></Routes></MemoryRouter>);

  await user.click((await screen.findAllByRole("button", { name: /move later/i }))[0]);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/images/order"), expect.objectContaining({ method: "PUT", body: expect.stringContaining(images[1].id) }));
  await user.click(screen.getAllByRole("button", { name: /remove image/i })[0]);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/images/"), expect.objectContaining({ method: "DELETE" }));
  expect(await screen.findByText(/image removed/i)).toBeVisible();
});
