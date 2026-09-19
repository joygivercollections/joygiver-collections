import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { CartLine, ValidatedCart } from "../../shared/contracts";
import { CartPage } from "../../app/cart/CartPage";
import { saveCart } from "../../app/cart/cart-store";

const available: CartLine = { productId: "a", reference: "JGC-A", name: "Ivory Gown", size: "M", quantity: 1, lastKnownPriceKobo: 28_500_00, imageUrl: null, selected: true };
const sold: CartLine = { productId: "b", reference: "JGC-B", name: "Rare Mini Skirt", size: "S", quantity: 1, lastKnownPriceKobo: 13_500_00, imageUrl: null, selected: true };

beforeEach(() => {
  localStorage.clear();
  saveCart([available, sold]);
});

it("clears selection for an item that becomes unavailable", async () => {
  const validated: ValidatedCart = {
    valid: [{ ...available, canonicalPriceKobo: available.lastKnownPriceKobo, priceChanged: false }],
    invalid: [{ ...sold, reason: "sold" }],
    subtotalKobo: available.lastKnownPriceKobo,
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(validated), { status: 200, headers: { "Content-Type": "application/json" } })));

  render(<MemoryRouter><CartPage whatsAppNumber="2348030000000" /></MemoryRouter>);

  expect(await screen.findByText(/no longer available/i)).toBeVisible();
  expect(screen.getByLabelText(sold.name)).not.toBeChecked();
  expect(screen.getByRole("link", { name: /order 1 selected item/i })).toHaveAttribute("href", expect.stringContaining("wa.me"));
});

it("lets a guest choose only one cart line for the order", async () => {
  const validated: ValidatedCart = {
    valid: [available, sold].map((line) => ({ ...line, canonicalPriceKobo: line.lastKnownPriceKobo, priceChanged: false })),
    invalid: [],
    subtotalKobo: available.lastKnownPriceKobo + sold.lastKnownPriceKobo,
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(validated), { status: 200, headers: { "Content-Type": "application/json" } })));
  const user = userEvent.setup();

  render(<MemoryRouter><CartPage whatsAppNumber="2348030000000" /></MemoryRouter>);
  await screen.findByRole("link", { name: /order 2 selected items/i });
  await user.click(screen.getByLabelText(sold.name));

  await waitFor(() => expect(screen.getByRole("link", { name: /order 1 selected item/i })).toBeVisible());
  expect(screen.getByText(/selected subtotal/i).nextElementSibling).toHaveTextContent("₦28,500");
});
