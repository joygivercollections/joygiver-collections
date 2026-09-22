import { useSyncExternalStore } from "react";
import type { FamilyCartLine, ProductCondition, RetailCartLine, WholesaleCartLine } from "../../shared/contracts";

const STORAGE_KEY = "joygiver-cart";
const CHANGE_EVENT = "joygiver-cart-change";
const VERSION = 2;

interface StoredCart {
  version: 2;
  lines: FamilyCartLine[];
}

let cachedRaw: string | null | undefined;
let cachedLines: FamilyCartLine[] = [];

function isCartLine(value: unknown): value is FamilyCartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<FamilyCartLine>;
  const identityIsValid = line.itemType === "wholesale"
    ? typeof (line as Partial<WholesaleCartLine>).packageId === "string"
    : line.itemType === "retail" || line.itemType === undefined
      ? typeof (line as Partial<RetailCartLine>).productId === "string" && typeof (line as Partial<RetailCartLine>).size === "string"
      : false;
  return identityIsValid
    && typeof line.reference === "string"
    && typeof line.name === "string"
    && Number.isInteger(line.quantity) && (line.quantity ?? 0) > 0
    && Number.isInteger(line.lastKnownPriceKobo) && (line.lastKnownPriceKobo ?? 0) > 0
    && (line.imageUrl === null || typeof line.imageUrl === "string")
    && typeof line.selected === "boolean";
}

function isVersionTwoLine(value: unknown): value is FamilyCartLine {
  return isCartLine(value) && ["retail", "wholesale"].includes(String((value as { itemType?: unknown }).itemType));
}

function isLegacyRetailLine(value: unknown): value is RetailCartLine {
  return isCartLine(value) && (value as { itemType?: unknown }).itemType !== "wholesale";
}

export function loadCart(): FamilyCartLine[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedLines;
  cachedRaw = raw;
  if (!raw) return (cachedLines = []);
  try {
    const stored = JSON.parse(raw) as { version?: unknown; lines?: unknown };
    if (!Array.isArray(stored.lines)) return (cachedLines = []);
    if (stored.version === 1 && stored.lines.every(isLegacyRetailLine)) {
      return (cachedLines = stored.lines.map((line) => ({ ...line, itemType: "retail" as const })));
    }
    if (stored.version !== VERSION || !stored.lines.every(isVersionTwoLine)) return (cachedLines = []);
    return (cachedLines = stored.lines);
  } catch {
    return (cachedLines = []);
  }
}

export function saveCart(lines: FamilyCartLine[]): void {
  if (typeof localStorage === "undefined") return;
  const normalized = lines.map((line) => line.itemType === "wholesale" ? line : { ...line, itemType: "retail" as const });
  const value: StoredCart = { version: VERSION, lines: normalized };
  cachedRaw = JSON.stringify(value);
  cachedLines = normalized;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function upsertCartLine(line: RetailCartLine, condition: ProductCondition): FamilyCartLine[] {
  const normalizedLine: RetailCartLine = { ...line, itemType: "retail" };
  const current = loadCart();
  const index = current.findIndex((item) => item.itemType !== "wholesale" && item.productId === normalizedLine.productId && item.size === normalizedLine.size);
  const next = [...current];
  if (index === -1) {
    next.push({ ...normalizedLine, quantity: condition === "thrifted" ? 1 : Math.max(1, normalizedLine.quantity), selected: true });
  } else {
    const existing = current[index];
    next[index] = {
      ...existing,
      ...normalizedLine,
      quantity: condition === "thrifted" ? 1 : Math.max(1, existing.quantity + normalizedLine.quantity),
      selected: true,
    };
  }
  saveCart(next);
  return next;
}

export function upsertWholesaleCartLine(line: WholesaleCartLine): FamilyCartLine[] {
  const current = loadCart();
  const index = current.findIndex((item) => item.itemType === "wholesale" && item.packageId === line.packageId);
  const next = [...current];
  if (index === -1) next.push({ ...line, quantity: Math.max(1, line.quantity), selected: true });
  else next[index] = { ...current[index], ...line, quantity: Math.max(1, current[index].quantity + line.quantity), selected: true };
  saveCart(next);
  return next;
}

export function setSelected(productId: string, selected: boolean, size?: string): void {
  saveCart(loadCart().map((line) => {
    const matches = line.itemType === "wholesale" ? line.packageId === productId : line.productId === productId && (!size || line.size === size);
    return matches ? { ...line, selected } : line;
  }));
}

export function setAllSelected(selected: boolean): void {
  saveCart(loadCart().map((line) => ({ ...line, selected })));
}

export function setQuantity(productId: string, size: string, quantity: number): void {
  saveCart(loadCart().map((line) => {
    const matches = line.itemType === "wholesale" ? line.packageId === productId : line.productId === productId && line.size === size;
    return matches ? { ...line, quantity: Math.max(1, Math.min(20, quantity)) } : line;
  }));
}

export function removeCartLine(productId: string, size: string): void {
  saveCart(loadCart().filter((line) => line.itemType === "wholesale" ? line.packageId !== productId : !(line.productId === productId && line.size === size)));
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

export function useCart(): FamilyCartLine[] {
  return useSyncExternalStore(subscribe, loadCart, () => []);
}
