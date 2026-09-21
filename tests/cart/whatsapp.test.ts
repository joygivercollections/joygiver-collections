import { describe, expect, it } from "vitest";
import type { ValidatedFamilyCartLine } from "../../shared/contracts";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "../../app/cart/whatsapp";

const gown: ValidatedFamilyCartLine = { itemType: "retail", productId: "a", reference: "JGC-A1B2", name: "Ivory Two-piece Set", size: "M", quantity: 7, lastKnownPriceKobo: 1_000_000, canonicalPriceKobo: 1_000_000, priceChanged: false, discountedQuantity: 6, discountKobo: 900_000, imageUrl: null, selected: true };
const bale: ValidatedFamilyCartLine = { itemType: "wholesale", packageId: "w", reference: "JGC-W-B2C3", name: "Denim Bale", quantity: 1, lastKnownPriceKobo: 2_000_000, canonicalPriceKobo: 2_000_000, priceChanged: false, discountedQuantity: 0, discountKobo: 0, imageUrl: null, selected: true };

describe("WhatsApp order formatting", () => {
  it("includes the selected validated order in a stable readable message", () => {
    const message = buildWhatsAppMessage({ customerName: "Ada", deliveryLocation: "Gwarinpa, Abuja", items: [gown, bale], regularSubtotalKobo: 9_000_000, promotion: { id: "promo", name: "Complete six", requiredQuantity: 6, discountBasisPoints: 1500, eligibleQuantity: 8, discountedQuantity: 6, discountKobo: 900_000 }, finalSubtotalKobo: 8_100_000 });
    expect(message).toContain("Ada");
    expect(message).toContain("Gwarinpa, Abuja");
    expect(message).toContain(gown.reference);
    expect(message).toContain(bale.reference);
    expect(message).toContain("Wholesale package");
    expect(message).toContain("6 discounted");
    expect(message).toContain("₦90,000");
    expect(message).toContain("-₦9,000");
    expect(message).toContain("₦81,000");
    expect(message).toContain("not a reservation until confirmed");
  });

  it("normalizes the phone and URL-encodes the message", () => {
    const url = buildWhatsAppUrl("+234 (803) 000-0000", "Hello & welcome");
    expect(url).toBe("https://wa.me/2348030000000?text=Hello%20%26%20welcome");
  });
});
