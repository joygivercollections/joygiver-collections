import type { ValidatedCartLine } from "../../shared/contracts";
import { formatNaira } from "../api";

interface WhatsAppOrder {
  customerName: string;
  deliveryLocation: string;
  items: ValidatedCartLine[];
  subtotalKobo: number;
}

export function buildWhatsAppMessage(order: WhatsAppOrder): string {
  const itemLines = order.items.map((item, index) => [
    `${index + 1}. ${item.name} (${item.reference})`,
    `   Size: ${item.size} | Qty: ${item.quantity} | Price: ${formatNaira(item.canonicalPriceKobo * item.quantity)}`,
  ].join("\n"));

  return [
    "Hello Joygiver Collections, I would like to order these items:",
    "",
    ...itemLines.flatMap((item, index) => index === 0 ? [item] : ["", item]),
    "",
    `Selected items subtotal: ${formatNaira(order.subtotalKobo)}`,
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
