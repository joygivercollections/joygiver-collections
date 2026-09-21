import type {
  ApiError,
  CategorySummary,
  CatalogueFilters,
  Paginated,
  Product,
  ProductSummary,
  AdminCategory,
  AdminProduct,
  InventorySummary,
  ProductImage,
  Audience,
  WholesaleFilters,
  WholesalePackage,
  WholesalePackageSummary,
  AdminWholesalePackage,
  PromotionSummary,
  AdminPromotion,
} from "../shared/contracts";
import type { ProductInput, PromotionInput, WholesalePackageInput } from "../shared/validation";

export class ApiRequestError extends Error implements ApiError {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly productCount?: number;

  constructor(error: ApiError & { productCount?: number }) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = error.status;
    this.code = error.code;
    this.fieldErrors = error.fieldErrors;
    this.productCount = error.productCount;
  }
}

async function requestJson<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    signal,
  });

  if (!response.ok) {
    let body: Partial<ApiError> & { productCount?: number } = {};
    try {
      body = (await response.json()) as Partial<ApiError>;
    } catch {
      // A useful normalized error is still returned when an edge error is not JSON.
    }
    throw new ApiRequestError({
      status: response.status,
      code: body.code ?? "request_failed",
      message: body.message ?? "We could not complete that request. Please try again.",
      fieldErrors: body.fieldErrors,
      productCount: body.productCount,
    });
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function buildProductQuery(filters: CatalogueFilters): string {
  const query = new URLSearchParams();
  if (filters.condition) query.set("condition", filters.condition);
  if (filters.audience) query.set("audience", filters.audience);
  if (filters.category) query.set("category", filters.category);
  if (filters.size) query.set("size", filters.size);
  if (filters.minPriceKobo !== undefined) query.set("minPriceKobo", String(filters.minPriceKobo));
  if (filters.maxPriceKobo !== undefined) query.set("maxPriceKobo", String(filters.maxPriceKobo));
  if (filters.search) query.set("search", filters.search);
  if (filters.sort) query.set("sort", filters.sort);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.limit) query.set("limit", String(filters.limit));
  return query.toString();
}

export function getProducts(filters: CatalogueFilters, signal?: AbortSignal) {
  return requestJson<Paginated<ProductSummary>>(`/api/products?${buildProductQuery(filters)}`, signal);
}

export function getProduct(slug: string, signal?: AbortSignal) {
  return requestJson<Product>(`/api/products/${encodeURIComponent(slug)}`, signal);
}

export function getCategories(audience?: Audience, signal?: AbortSignal) {
  const query = audience ? `?audience=${encodeURIComponent(audience)}` : "";
  return requestJson<CategorySummary[]>(`/api/categories${query}`, signal);
}

export function buildWholesaleQuery(filters: WholesaleFilters): string {
  const query = new URLSearchParams();
  if (filters.audience) query.set("audience", filters.audience);
  if (filters.condition) query.set("condition", filters.condition);
  if (filters.category) query.set("category", filters.category);
  if (filters.minPieceCount !== undefined) query.set("minPieceCount", String(filters.minPieceCount));
  if (filters.maxPieceCount !== undefined) query.set("maxPieceCount", String(filters.maxPieceCount));
  if (filters.minPriceKobo !== undefined) query.set("minPriceKobo", String(filters.minPriceKobo));
  if (filters.maxPriceKobo !== undefined) query.set("maxPriceKobo", String(filters.maxPriceKobo));
  if (filters.availability) query.set("availability", filters.availability);
  if (filters.search) query.set("search", filters.search);
  if (filters.sort) query.set("sort", filters.sort);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.limit) query.set("limit", String(filters.limit));
  return query.toString();
}

export function getWholesalePackages(filters: WholesaleFilters, signal?: AbortSignal) {
  return requestJson<Paginated<WholesalePackageSummary>>(`/api/wholesale?${buildWholesaleQuery(filters)}`, signal);
}

export function getWholesalePackage(slug: string, signal?: AbortSignal) {
  return requestJson<WholesalePackage>(`/api/wholesale/${encodeURIComponent(slug)}`, signal);
}

export function getStoreConfig(signal?: AbortSignal) {
  return requestJson<{ whatsAppNumber: string }>("/api/config", signal);
}

export function getActivePromotion(signal?: AbortSignal) {
  return requestJson<PromotionSummary | null>("/api/promotion", signal);
}

export function validateCart(lines: import("../shared/contracts").CartLine[], signal?: AbortSignal) {
  return requestJson<import("../shared/contracts").ValidatedCart>("/api/cart/validate", signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: lines }),
  });
}

export function formatNaira(priceKobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(priceKobo / 100);
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export interface OwnerSession { id: string; email: string }

export const ownerApi = {
  session: (signal?: AbortSignal) => requestJson<OwnerSession>("/api/auth/session", signal),
  login: (email: string, password: string, signal?: AbortSignal) => requestJson<OwnerSession>("/api/auth/login", signal, jsonRequest("POST", { email, password })),
  logout: () => requestJson<void>("/api/auth/logout", undefined, jsonRequest("POST")),
  changePassword: (currentPassword: string, newPassword: string) => requestJson<{ ok: true }>("/api/auth/password", undefined, jsonRequest("PUT", { currentPassword, newPassword })),
  summary: (signal?: AbortSignal) => requestJson<InventorySummary>("/api/admin/summary", signal),
  products: (filters: Record<string, string | undefined> = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    return requestJson<Paginated<AdminProduct>>(`/api/admin/products?${query}`, signal);
  },
  product: (id: string, signal?: AbortSignal) => requestJson<AdminProduct>(`/api/admin/products/${encodeURIComponent(id)}`, signal),
  createProduct: (input: ProductInput) => requestJson<AdminProduct>("/api/admin/products", undefined, jsonRequest("POST", input)),
  updateProduct: (id: string, input: ProductInput) => requestJson<AdminProduct>(`/api/admin/products/${encodeURIComponent(id)}`, undefined, jsonRequest("PUT", input)),
  setProductState: (id: string, state: "available" | "sold" | "hidden") => requestJson<AdminProduct>(`/api/admin/products/${encodeURIComponent(id)}/state`, undefined, jsonRequest("PUT", { state })),
  deleteProduct: (id: string, confirmReference: string) => requestJson<void>(`/api/admin/products/${encodeURIComponent(id)}`, undefined, jsonRequest("DELETE", { confirmReference })),
  categories: (signal?: AbortSignal) => requestJson<AdminCategory[]>("/api/admin/categories", signal),
  createCategory: (input: { name: string; displayOrder: number; active: boolean; audiences: Audience[] }) => requestJson<AdminCategory>("/api/admin/categories", undefined, jsonRequest("POST", input)),
  updateCategory: (id: string, input: { name: string; displayOrder: number; active: boolean; audiences: Audience[] }) => requestJson<AdminCategory>(`/api/admin/categories/${encodeURIComponent(id)}`, undefined, jsonRequest("PUT", input)),
  retireCategory: (id: string) => requestJson<void>(`/api/admin/categories/${encodeURIComponent(id)}`, undefined, { method: "DELETE" }),
  wholesale: (filters: Record<string, string | undefined> = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    return requestJson<Paginated<AdminWholesalePackage>>(`/api/admin/wholesale?${query}`, signal);
  },
  wholesalePackage: (id: string, signal?: AbortSignal) => requestJson<AdminWholesalePackage>(`/api/admin/wholesale/${encodeURIComponent(id)}`, signal),
  createWholesale: (input: WholesalePackageInput) => requestJson<AdminWholesalePackage>("/api/admin/wholesale", undefined, jsonRequest("POST", input)),
  updateWholesale: (id: string, input: WholesalePackageInput) => requestJson<AdminWholesalePackage>(`/api/admin/wholesale/${encodeURIComponent(id)}`, undefined, jsonRequest("PUT", input)),
  setWholesaleState: (id: string, state: "available" | "sold" | "hidden") => requestJson<AdminWholesalePackage>(`/api/admin/wholesale/${encodeURIComponent(id)}/state`, undefined, jsonRequest("PUT", { state })),
  deleteWholesale: (id: string, confirmReference: string) => requestJson<void>(`/api/admin/wholesale/${encodeURIComponent(id)}`, undefined, jsonRequest("DELETE", { confirmReference })),
  uploadWholesaleImage: async (packageId: string, file: File): Promise<ProductImage> => {
    const body = new FormData();
    body.append("images", file);
    body.append("altText", file.name.replace(/\.[^.]+$/, ""));
    const result = await requestJson<{ images: ProductImage[] }>(`/api/admin/wholesale/${encodeURIComponent(packageId)}/images`, undefined, { method: "POST", body });
    return result.images[0];
  },
  deleteWholesaleImage: (packageId: string, imageId: string) => requestJson<void>(`/api/admin/wholesale/${encodeURIComponent(packageId)}/images/${encodeURIComponent(imageId)}`, undefined, { method: "DELETE" }),
  reorderWholesaleImages: (packageId: string, imageIds: string[]) => requestJson<{ images: ProductImage[] }>(`/api/admin/wholesale/${encodeURIComponent(packageId)}/images/order`, undefined, jsonRequest("PUT", { imageIds })),
  promotions: (signal?: AbortSignal) => requestJson<AdminPromotion[]>("/api/admin/promotions", signal),
  promotion: (id: string, signal?: AbortSignal) => requestJson<AdminPromotion>(`/api/admin/promotions/${encodeURIComponent(id)}`, signal),
  createPromotion: (input: PromotionInput) => requestJson<AdminPromotion>("/api/admin/promotions", undefined, jsonRequest("POST", input)),
  updatePromotion: (id: string, input: PromotionInput) => requestJson<AdminPromotion>(`/api/admin/promotions/${encodeURIComponent(id)}`, undefined, jsonRequest("PUT", input)),
  deletePromotion: (id: string) => requestJson<void>(`/api/admin/promotions/${encodeURIComponent(id)}`, undefined, { method: "DELETE" }),
  uploadImage: async (productId: string, file: File): Promise<ProductImage> => {
    const body = new FormData();
    body.append("images", file);
    body.append("altText", file.name.replace(/\.[^.]+$/, ""));
    const result = await requestJson<{ images: ProductImage[] }>(`/api/admin/products/${encodeURIComponent(productId)}/images`, undefined, { method: "POST", body });
    return result.images[0];
  },
  deleteImage: (productId: string, imageId: string) => requestJson<void>(`/api/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, undefined, { method: "DELETE" }),
  reorderImages: (productId: string, imageIds: string[]) => requestJson<{ images: ProductImage[] }>(`/api/admin/products/${encodeURIComponent(productId)}/images/order`, undefined, jsonRequest("PUT", { imageIds })),
};
