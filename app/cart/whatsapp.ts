import type { PromotionBreakdown, ValidatedFamilyCartLine } from "../../shared/contracts";
import { formatNaira } from "../api";

interface WhatsAppOrder {
  customerName: string;
  deliveryLocation: string;
  items: ValidatedFamilyCartLine[];
  regularSubtotalKobo: number;
  promotion: PromotionBreakdown | null;
  finalSubtotalKobo: number;
}

export function buildWhatsAppMessage(order: WhatsAppOrder): string {
  const itemLines = order.items.map((item, index) => [
    `${index + 1}. ${item.name} (${item.reference})`,
    `   ${item.itemType === "wholesale" ? "Wholesale package" : `Size: ${item.size}`} | Qty: ${item.quantity} | Price: ${formatNaira(item.canonicalPriceKobo * item.quantity)}`,
    item.discountedQuantity > 0 ? `   ${item.discountedQuantity} discounted | Savings: ${formatNaira(item.discountKobo)}` : "",
  ].join("\n"));

  const promotionLines = order.promotion ? [
    `Regular subtotal: ${formatNaira(order.regularSubtotalKobo)}`,
    `${order.promotion.name}: ${order.promotion.discountBasisPoints / 100}% off ${order.promotion.discountedQuantity} discounted item${order.promotion.discountedQuantity === 1 ? "" : "s"}`,
    `Promotion discount: -${formatNaira(order.promotion.discountKobo)}`,
  ] : [];

  return [
    "Hello Joygiver Collections, I would like to order these items:",
    "",
    ...itemLines.flatMap((item, index) => index === 0 ? [item] : ["", item]),
    "",
    ...promotionLines,
    `Final selected subtotal: ${formatNaira(order.finalSubtotalKobo)}`,
    `Customer: ${order.customerName.trim() || "Not provided"}`,
    `Delivery location: ${order.deliveryLocation.trim() || "Not provided"}`,
    "",
    "Please confirm availability and the nationwide delivery fee. I understand this request is not a reservation until confirmed.",
  ].join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
