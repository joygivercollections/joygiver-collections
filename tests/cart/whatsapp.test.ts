import { describe, expect, it } from "vitest";
import type { ValidatedCartLine } from "../../shared/contracts";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "../../app/cart/whatsapp";

const gown: ValidatedCartLine = { productId: "a", reference: "JGC-A1B2", name: "Ivory Two-piece Set", size: "M", quantity: 1, lastKnownPriceKobo: 28_500_00, canonicalPriceKobo: 28_500_00, priceChanged: false, imageUrl: null, selected: true };
const jeans: ValidatedCartLine = { ...gown, productId: "b", reference: "JGC-B2C3", name: "Indigo Jeans", size: "L", canonicalPriceKobo: 13_500_00 };

describe("WhatsApp order formatting", () => {
  it("includes the selected validated order in a stable readable message", () => {
    const message = buildWhatsAppMessage({ customerName: "Ada", deliveryLocation: "Gwarinpa, Abuja", items: [gown, jeans], subtotalKobo: 42_000_00 });
    expect(message).toContain("Ada");
    expect(message).toContain("Gwarinpa, Abuja");
    expect(message).toContain(gown.reference);
    expect(message).toContain(jeans.reference);
    expect(message).toContain("₦42,000");
    expect(message).toContain("not a reservation until confirmed");
  });

  it("normalizes the phone and URL-encodes the message", () => {
    const url = buildWhatsAppUrl("+234 (803) 000-0000", "Hello & welcome");
    expect(url).toBe("https://wa.me/2348030000000?text=Hello%20%26%20welcome");
  });
});
