import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../../app/App";
import type { ProductSummary, WholesalePackage } from "../../shared/contracts";

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const retail: ProductSummary = {
  id: "retail-men-shirt",
  reference: "JGC-M-101",
  slug: "linen-shirt",
  name: "Linen Shirt",
  priceKobo: 900_000,
  condition: "new",
  category: { id: "cat-shirts", name: "Shirts", slug: "shirts" },
  audiences: ["men"],
  isUnisex: false,
  promoEligible: true,
  sizes: ["L"],
  tags: [],
  stockQuantity: 4,
  state: "available",
  soldAt: null,
  primaryImage: null,
  publishedAt: "2026-09-21T10:00:00.000Z",
};

const wholesale: WholesalePackage = {
  id: "wholesale-family-denim",
  reference: "JGC-W-201",
  slug: "family-denim-package",
  name: "Family Denim Package",
  description: "A photographed package of assorted denim.",
  audiences: ["women", "men", "kids"],
  conditionScope: "mixed",
  categories: [{ id: "cat-jeans", name: "Jeans", slug: "jeans" }],
  pieceCount: 24,
  priceKobo: 1_900_000,
  stockQuantity: 2,
  state: "available",
  soldAt: null,
  featured: true,
  promoEligible: true,
  primaryImage: null,
  publishedAt: "2026-09-21T09:00:00.000Z",
  images: [],
};

it("carries a legacy cart through family shopping and sends only selected canonical totals to WhatsApp", async () => {
  localStorage.setItem("joygiver-cart", JSON.stringify({
    version: 1,
    lines: [{ productId: "legacy-skirt", reference: "JGC-OLD-1", name: "Legacy Skirt", size: "M", quantity: 1, lastKnownPriceKobo: 500_000, imageUrl: null, selected: true }],
  }));

  vi.stubGlobal("fetch", vi.fn(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/settings")) return okJson({ logoUrl: "/brand/joygiver-logo.jpeg", heroUrl: "/brand/family-hero.png", heroHeading: "Style for every story.", heroCopy: "Family fashion." });
    if (url.includes("/api/config")) return okJson({ whatsAppNumber: "2348069010690" });
    if (url.includes("/api/categories")) return okJson([retail.category]);
    if (url.includes("/api/products")) return okJson({ items: [retail], page: 1, pageSize: 24, total: 1 });
    if (url.endsWith(`/api/wholesale/${wholesale.slug}`)) return okJson(wholesale);
    if (url.includes("/api/wholesale")) return okJson({ items: [wholesale], page: 1, pageSize: 24, total: 1 });
    if (url.includes("/api/cart/validate")) {
      const requested = JSON.parse(String(init?.body)) as { items: Array<Record<string, unknown>> };
      const valid: Array<Record<string, unknown> & { itemType: string; canonicalPriceKobo: number; priceChanged: boolean; discountedQuantity: number; discountKobo: number }> = requested.items.map((line) => {
        const itemType = line.itemType === "wholesale" ? "wholesale" : "retail";
        const canonicalPriceKobo = itemType === "wholesale" ? 2_000_000 : line.productId === retail.id ? 1_000_000 : 500_000;
        const eligible = itemType === "wholesale" || line.productId === retail.id;
        return { ...line, itemType, canonicalPriceKobo, priceChanged: canonicalPriceKobo !== line.lastKnownPriceKobo, discountedQuantity: eligible ? 1 : 0, discountKobo: eligible ? canonicalPriceKobo / 10 : 0 };
      });
      const eligible = valid.filter((line) => line.packageId === wholesale.id || line.productId === retail.id);
      const regularSubtotalKobo = valid.reduce((total, line) => total + Number(line.canonicalPriceKobo) * Number(line.quantity), 0);
      const discountKobo = eligible.length >= 2 ? eligible.reduce((total, line) => total + Number(line.canonicalPriceKobo) / 10, 0) : 0;
      return okJson({ valid, invalid: [], subtotalKobo: regularSubtotalKobo, regularSubtotalKobo, promotion: { id: "promo-family", name: "Family pair", requiredQuantity: 2, discountBasisPoints: 1000, eligibleQuantity: eligible.length, discountedQuantity: eligible.length >= 2 ? 2 : 0, discountKobo }, finalSubtotalKobo: regularSubtotalKobo - discountKobo });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));

  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/new/men"]}><App /></MemoryRouter>);

  expect(await screen.findByRole("heading", { name: /new for men/i })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /quick add/i }));
  const primary = screen.getByRole("navigation", { name: /primary navigation/i });
  await user.click(within(primary).getByRole("link", { name: "Wholesale" }));
  await user.click(await screen.findByRole("link", { name: `View ${wholesale.name}` }));
  await user.click(await screen.findByRole("button", { name: /add 1 package to bag/i }));
  await user.click(screen.getByRole("link", { name: /view bag/i }));

  const legacyToggle = await screen.findByRole("checkbox", { name: "Legacy Skirt" });
  await user.click(legacyToggle);
  const orderLink = await screen.findByRole("link", { name: /order 2 selected items on whatsapp/i });
  await waitFor(() => expect(screen.getByText(/final selected subtotal/i).nextElementSibling).toHaveTextContent("₦27,000"));

  const href = orderLink.getAttribute("href") ?? "";
  const message = new URL(href).searchParams.get("text") ?? "";
  expect(message).toContain("Linen Shirt (JGC-M-101)");
  expect(message).toContain("Family Denim Package (JGC-W-201)");
  expect(message).not.toContain("Legacy Skirt");
  expect(message).toContain("Final selected subtotal: ₦27,000");
  await user.click(orderLink);
});
