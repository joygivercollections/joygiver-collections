import { beforeEach, describe, expect, it } from "vitest";
import type { CartLine } from "../../shared/contracts";
import { loadCart, saveCart, upsertCartLine } from "../../app/cart/cart-store";

const lineA: CartLine = { productId: "a", reference: "JGC-A", name: "Ivory gown", size: "M", quantity: 1, lastKnownPriceKobo: 28_500_00, imageUrl: null, selected: false };
const lineB: CartLine = { productId: "b", reference: "JGC-B", name: "Indigo jeans", size: "L", quantity: 1, lastKnownPriceKobo: 13_500_00, imageUrl: null, selected: true };

beforeEach(() => localStorage.clear());

describe("guest cart storage", () => {
  it("persists item selection and restores a versioned cart", () => {
    saveCart([lineA, lineB]);
    expect(loadCart().map((line) => ({ productId: line.itemType === "wholesale" ? line.packageId : line.productId, selected: line.selected }))).toEqual([
      { productId: lineA.productId, selected: false },
      { productId: lineB.productId, selected: true },
    ]);
  });

  it("recovers from corrupt or future-version local storage without throwing", () => {
    localStorage.setItem("joygiver-cart", "not-json");
    expect(loadCart()).toEqual([]);
    localStorage.setItem("joygiver-cart", JSON.stringify({ version: 99, lines: [lineA] }));
    expect(loadCart()).toEqual([]);
  });

  it("merges the same product and size and caps thrifted quantities at one", () => {
    upsertCartLine({ ...lineA, quantity: 1 }, "new");
    upsertCartLine({ ...lineA, quantity: 2 }, "new");
    expect(loadCart()[0].quantity).toBe(3);

    localStorage.clear();
    upsertCartLine({ ...lineB, quantity: 1 }, "thrifted");
    upsertCartLine({ ...lineB, quantity: 1 }, "thrifted");
    expect(loadCart()[0].quantity).toBe(1);
  });
});
