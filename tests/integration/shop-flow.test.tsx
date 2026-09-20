import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { loadCart, saveCart } from "../../app/cart/cart-store";

it("preserves a guest cart when catalogue loading fails", async () => {
  const line = { productId: "gown-1", reference: "JGC-G1", name: "Emerald Gown", size: "M", quantity: 1, lastKnownPriceKobo: 24_000_00, imageUrl: null, selected: true };
  saveCart([line]);
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    if (String(input).includes("categories")) return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error("offline");
  }));
  render(<MemoryRouter initialEntries={["/new"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("button", { name: /try again/i })).toBeVisible();
  expect(loadCart()).toEqual(expect.arrayContaining([expect.objectContaining({ productId: "gown-1" })]));
});
