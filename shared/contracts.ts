export type ProductCondition = "new" | "thrifted";
export type ProductState = "available" | "sold" | "hidden";

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  displayOrder: number;
}

export interface ProductSummary {
  id: string;
  reference: string;
  slug: string;
  name: string;
  priceKobo: number;
  condition: ProductCondition;
  category: CategorySummary;
  sizes: string[];
  tags: string[];
  stockQuantity: number;
  state: ProductState;
  soldAt: string | null;
  primaryImage: Pick<ProductImage, "url" | "alt"> | null;
  publishedAt: string;
}

export interface Product extends ProductSummary {
  description: string;
  featured: boolean;
  images: ProductImage[];
}

export interface CatalogueFilters {
  condition?: ProductCondition;
  category?: string;
  size?: string;
  minPriceKobo?: number;
  maxPriceKobo?: number;
  search?: string;
  sort?: "latest" | "price-asc" | "price-desc";
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CartLine {
  productId: string;
  reference: string;
  name: string;
  size: string;
  quantity: number;
  lastKnownPriceKobo: number;
  imageUrl: string | null;
  selected: boolean;
}

export interface ValidatedCartLine extends CartLine {
  canonicalPriceKobo: number;
  priceChanged: boolean;
}

export type InvalidCartReason =
  | "sold"
  | "hidden"
  | "deleted"
  | "out_of_stock"
  | "size_unavailable"
  | "quantity_reduced";

export interface ValidatedCart {
  valid: ValidatedCartLine[];
  invalid: Array<CartLine & { reason: InvalidCartReason }>;
  subtotalKobo: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
