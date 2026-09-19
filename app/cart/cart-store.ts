import { useSyncExternalStore } from "react";
import type { CartLine, ProductCondition } from "../../shared/contracts";

const STORAGE_KEY = "joygiver-cart";
const CHANGE_EVENT = "joygiver-cart-change";
const VERSION = 1;

interface StoredCart {
  version: 1;
  lines: CartLine[];
}

let cachedRaw: string | null | undefined;
let cachedLines: CartLine[] = [];

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return typeof line.productId === "string"
    && typeof line.reference === "string"
    && typeof line.name === "string"
    && typeof line.size === "string"
    && Number.isInteger(line.quantity) && (line.quantity ?? 0) > 0
    && Number.isInteger(line.lastKnownPriceKobo) && (line.lastKnownPriceKobo ?? -1) >= 0
    && (line.imageUrl === null || typeof line.imageUrl === "string")
    && typeof line.selected === "boolean";
}

export function loadCart(): CartLine[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedLines;
  cachedRaw = raw;
  if (!raw) return (cachedLines = []);
  try {
    const stored = JSON.parse(raw) as Partial<StoredCart>;
    if (stored.version !== VERSION || !Array.isArray(stored.lines) || !stored.lines.every(isCartLine)) {
      return (cachedLines = []);
    }
    return (cachedLines = stored.lines);
  } catch {
    return (cachedLines = []);
  }
}

export function saveCart(lines: CartLine[]): void {
  if (typeof localStorage === "undefined") return;
  const value: StoredCart = { version: VERSION, lines };
  cachedRaw = JSON.stringify(value);
  cachedLines = lines;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function upsertCartLine(line: CartLine, condition: ProductCondition): CartLine[] {
  const current = loadCart();
  const index = current.findIndex((item) => item.productId === line.productId && item.size === line.size);
  const next = [...current];
  if (index === -1) {
    next.push({ ...line, quantity: condition === "thrifted" ? 1 : Math.max(1, line.quantity), selected: true });
  } else {
    const existing = current[index];
    next[index] = {
      ...existing,
      ...line,
      quantity: condition === "thrifted" ? 1 : Math.max(1, existing.quantity + line.quantity),
      selected: true,
    };
  }
  saveCart(next);
  return next;
}

export function setSelected(productId: string, selected: boolean, size?: string): void {
  saveCart(loadCart().map((line) => line.productId === productId && (!size || line.size === size) ? { ...line, selected } : line));
}

export function setAllSelected(selected: boolean): void {
  saveCart(loadCart().map((line) => ({ ...line, selected })));
}

export function setQuantity(productId: string, size: string, quantity: number): void {
  saveCart(loadCart().map((line) => line.productId === productId && line.size === size ? { ...line, quantity: Math.max(1, Math.min(20, quantity)) } : line));
}

export function removeCartLine(productId: string, size: string): void {
  saveCart(loadCart().filter((line) => !(line.productId === productId && line.size === size)));
}

function subscribe(listener: () => void): () => void {
  const update = () => {
    cachedRaw = undefined;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(CHANGE_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, loadCart, () => []);
}
