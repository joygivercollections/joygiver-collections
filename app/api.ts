import type {
  ApiError,
  CategorySummary,
  CatalogueFilters,
  Paginated,
  Product,
  ProductSummary,
} from "../shared/contracts";

export class ApiRequestError extends Error implements ApiError {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = error.status;
    this.code = error.code;
    this.fieldErrors = error.fieldErrors;
  }
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    let body: Partial<ApiError> = {};
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
    });
  }

  return response.json() as Promise<T>;
}

export function buildProductQuery(filters: CatalogueFilters): string {
  const query = new URLSearchParams();
  if (filters.condition) query.set("condition", filters.condition);
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

export function getCategories(signal?: AbortSignal) {
  return requestJson<CategorySummary[]>("/api/categories", signal);
}

export function formatNaira(priceKobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(priceKobo / 100);
}
