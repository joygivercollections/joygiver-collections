import { describe, expect, it } from "vitest";
import { calculatePromotion } from "../../worker/lib/promotions";

describe("complete-group promotion calculator", () => {
  it.each([[5, 0], [6, 6], [7, 6], [11, 6], [12, 12], [18, 18]])(
    "discounts only complete groups for %i units",
    (quantity, discountedQuantity) => {
      const result = calculatePromotion(
        [{ key: "retail:a:M", unitPriceKobo: 10_000, quantity, eligible: true }],
        { requiredQuantity: 6, discountBasisPoints: 1500 },
      );
      expect(result.discountedQuantity).toBe(discountedQuantity);
    },
  );

  it("discounts the cheapest eligible units with stable allocation and whole-kobo flooring", () => {
    const result = calculatePromotion([
      { key: "retail:expensive:M", unitPriceKobo: 20_000, quantity: 4, eligible: true },
      { key: "wholesale:cheap", unitPriceKobo: 9_999, quantity: 4, eligible: true },
      { key: "retail:ignored:S", unitPriceKobo: 100, quantity: 20, eligible: false },
    ], { requiredQuantity: 6, discountBasisPoints: 1500 });

    expect(result).toMatchObject({ eligibleQuantity: 8, discountedQuantity: 6, discountKobo: 11_996 });
    expect(result.lines).toEqual([
      { key: "retail:expensive:M", discountedQuantity: 2, discountKobo: 6_000 },
      { key: "wholesale:cheap", discountedQuantity: 4, discountKobo: 5_996 },
      { key: "retail:ignored:S", discountedQuantity: 0, discountKobo: 0 },
    ]);
  });
});
