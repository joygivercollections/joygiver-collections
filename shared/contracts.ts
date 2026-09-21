export type ProductCondition = "new" | "thrifted";
export type ProductState = "available" | "sold" | "hidden";
export type Audience = "women" | "men" | "kids";
export type WholesaleConditionScope = ProductCondition | "mixed";

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  audiences?: Audience[];
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
  audiences?: Audience[];
  isUnisex?: boolean;
  promoEligible?: boolean;
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

export interface AdminProduct extends Omit<Product, "publishedAt"> {
  published: boolean;
  publishedAt: string | null;
}

export interface AdminCategory extends CategorySummary {
  active: boolean;
  displayOrder: number;
}

export interface InventorySummary {
  total: number;
  available: number;
  sold: number;
  hidden: number;
  new: number;
  thrifted: number;
}

export interface CatalogueFilters {
  condition?: ProductCondition;
  audience?: Audience;
  category?: string;
  size?: string;
  minPriceKobo?: number;
  maxPriceKobo?: number;
  search?: string;
  sort?: "latest" | "price-asc" | "price-desc";
  page?: number;
  limit?: number;
}

export interface WholesaleFilters {
  audience?: Audience;
  condition?: WholesaleConditionScope;
  category?: string;
  minPieceCount?: number;
  maxPieceCount?: number;
  minPriceKobo?: number;
  maxPriceKobo?: number;
  availability?: "available" | "sold";
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

export interface WholesalePackageSummary {
  id: string;
  reference: string;
  slug: string;
  name: string;
  description: string;
  audiences: Audience[];
  conditionScope: WholesaleConditionScope;
  categories: CategorySummary[];
  pieceCount: number;
  priceKobo: number;
  stockQuantity: number;
  state: ProductState;
  soldAt: string | null;
  featured: boolean;
  promoEligible?: boolean;
  primaryImage: Pick<ProductImage, "url" | "alt"> | null;
  publishedAt: string;
}

export interface WholesalePackage extends WholesalePackageSummary {
  images: ProductImage[];
}

export interface AdminWholesalePackage extends Omit<WholesalePackage, "publishedAt"> {
  published: boolean;
  publishedAt: string | null;
}

export interface PromotionSummary {
  id: string;
  name: string;
  description: string;
  requiredQuantity: number;
  discountBasisPoints: number;
  startAt: string;
  endAt: string;
}

export interface AdminPromotion extends PromotionSummary {
  paused: boolean;
  productIds: string[];
  wholesalePackageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  logoUrl: string;
  heroUrl: string;
  heroHeading: string;
  heroCopy: string;
}

export type CartItemType = "retail" | "wholesale";

export interface CartLineBase {
  reference: string;
  name: string;
  quantity: number;
  lastKnownPriceKobo: number;
  imageUrl: string | null;
  selected: boolean;
}

export interface RetailCartLine extends CartLineBase {
  itemType?: "retail";
  productId: string;
  size: string;
}

export interface WholesaleCartLine extends CartLineBase {
  itemType: "wholesale";
  packageId: string;
}

export type FamilyCartLine = RetailCartLine | WholesaleCartLine;
export type CartLine = RetailCartLine;

export type ValidatedCartLine = CartLine & {
  canonicalPriceKobo: number;
  priceChanged: boolean;
  discountedQuantity?: number;
  discountKobo?: number;
};

export type ValidatedFamilyCartLine = FamilyCartLine & {
  canonicalPriceKobo: number;
  priceChanged: boolean;
  discountedQuantity: number;
  discountKobo: number;
};

export type InvalidCartReason =
  | "sold"
  | "hidden"
  | "deleted"
  | "out_of_stock"
  | "size_unavailable"
  | "quantity_reduced";

export type InvalidCartLine = CartLine & { reason: InvalidCartReason };

export interface PromotionBreakdown {
  id: string;
  name: string;
  requiredQuantity: number;
  discountBasisPoints: number;
  eligibleQuantity: number;
  discountedQuantity: number;
  discountKobo: number;
}

export interface ValidatedCart {
  valid: ValidatedCartLine[];
  invalid: InvalidCartLine[];
  subtotalKobo: number;
  regularSubtotalKobo?: number;
  promotion?: PromotionBreakdown | null;
  finalSubtotalKobo?: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
