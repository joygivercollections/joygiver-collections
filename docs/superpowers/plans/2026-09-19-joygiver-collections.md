# Joygiver Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a mobile-first Joygiver Collections storefront with searchable New and Thrifted catalogues, a selective guest cart that creates one WhatsApp order message, and a secure owner dashboard backed by Cloudflare D1 and R2.

**Architecture:** A single TypeScript Cloudflare Worker serves a React SPA and same-origin JSON API. D1 owns catalogue, admin, and session records; R2 owns product images; the browser owns the anonymous cart and always revalidates selected items before generating a WhatsApp message.

**Tech Stack:** TypeScript, React, React Router, Vite with the Cloudflare plugin, Hono, Zod, Cloudflare Workers, D1, R2, Web Crypto, Vitest, React Testing Library, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-09-19-joygiver-collections-design.md`

## Global Constraints

- Brand name is `Joygiver Collections`; preferred production domain is `joygivercollections.com`.
- The public experience is mobile-first, minimal, elegant, luxurious, and usable on desktop.
- Store currency is Nigerian naira; persist monetary values as integer kobo.
- The store serves Abuja, FCT and delivers nationwide across Nigeria.
- Public shopping requires no account; owner management requires the single configured email-and-password account.
- Product condition is exactly `new` or `thrifted`; the condition must be visible on every product card and detail view.
- Initial categories are Mini Skirts, Maxi Skirts, Sleeveless Tops, Crop Tops, Two-piece Sets, Jeans, Gowns, and Jumpsuits.
- A sold product remains public for 48 hours with ordering disabled, then disappears publicly while remaining in the dashboard.
- The cart can contain many items, but the WhatsApp request includes only selected, currently available items.
- Thrifted products have a maximum purchasable quantity of one.
- Product photos accept JPEG, PNG, or WebP only, up to 8 MiB per file and six images per product.
- Do not add customer accounts, card payments, delivery-fee calculation, automatic reservations, stored orders, ratings, wish lists, or automated password-recovery email.

## Review Focus

- A cart item becomes sold, hidden, deleted, or repriced after being added: checkout must show the change and exclude unavailable items before opening WhatsApp.
- A sold timestamp falls exactly on the 48-hour boundary: public catalogue queries must exclude the item consistently.
- Search and filters contain apostrophes, percent signs, mixed case, empty strings, or unknown categories: queries must stay parameterized and return a stable result.
- An expired or forged session attempts a product or image mutation: the API must return `401` and change neither D1 nor R2.
- An image upload has a misleading extension, unsupported MIME type, excessive size, or partial R2 failure: the form must retain its fields and the database must not reference a missing object.

## Planned file structure

```text
.
├── app/
│   ├── api.ts                         # Typed browser API client and error normalization
│   ├── App.tsx                        # Router and public/admin route boundaries
│   ├── main.tsx                       # Browser entry point
│   ├── styles/
│   │   ├── globals.css                 # Brand tokens, reset, typography, shared responsive rules
│   │   └── components.css              # Product, filter, cart, form, and dashboard styling
│   ├── components/
│   │   ├── Layout.tsx                  # Announcement bar, header, navigation, footer
│   │   ├── ProductCard.tsx             # Product summary and condition/sold badges
│   │   ├── ProductGrid.tsx             # Loading, empty, error, and product grid states
│   │   ├── FilterSheet.tsx             # Mobile/desktop filters and sorting
│   │   └── RouteError.tsx              # Route-level recoverable error state
│   ├── cart/
│   │   ├── cart-store.ts               # Versioned local cart persistence and selection state
│   │   ├── whatsapp.ts                 # Deterministic order message and wa.me URL
│   │   └── CartPage.tsx                 # Selective checkout UI and revalidation
│   ├── pages/
│   │   ├── HomePage.tsx                 # Hero, search, latest eight, condition links, delivery copy
│   │   ├── CataloguePage.tsx            # New/Thrifted route with filtering and sorting
│   │   └── ProductPage.tsx              # Gallery, details, tags, and add-to-cart action
│   └── admin/
│       ├── LoginPage.tsx                # Owner login
│       ├── AdminLayout.tsx              # Authenticated dashboard navigation
│       ├── DashboardPage.tsx            # Inventory summary counts
│       ├── ProductsPage.tsx             # Owner inventory search and actions
│       ├── ProductForm.tsx              # Add/edit product and image management
│       ├── CategoriesPage.tsx           # Create, rename, reorder, and retire categories
│       └── AccountPage.tsx              # Authenticated password change
├── shared/
│   ├── contracts.ts                     # Product, cart, filters, admin, and API response types
│   └── validation.ts                    # Shared Zod input schemas
├── worker/
│   ├── index.ts                         # Hono entry point, bindings, middleware, API/static routing
│   ├── db/
│   │   ├── products.ts                   # Catalogue queries and product mutations
│   │   ├── categories.ts                 # Category queries and mutations
│   │   └── auth.ts                       # Admin, session, and login-attempt queries
│   ├── lib/
│   │   ├── password.ts                   # PBKDF2 hashing and verification
│   │   ├── session.ts                    # Opaque session creation and cookie handling
│   │   └── origin.ts                     # Same-origin mutation protection
│   └── routes/
│       ├── public.ts                     # Catalogue, product, media, cart-validation endpoints
│       ├── auth.ts                       # Bootstrap, login, logout, session, password endpoints
│       └── admin.ts                      # Product, image, category, and summary endpoints
├── migrations/
│   └── 0001_initial.sql                 # Complete D1 schema and initial categories
├── scripts/
│   └── smoke-production.mjs             # Read-only production route/API checks
├── tests/
│   ├── setup.ts                         # DOM matchers, cleanup, storage reset
│   ├── worker/                           # Worker unit/integration tests with binding fakes
│   ├── cart/                             # Cart persistence and WhatsApp tests
│   ├── pages/                            # Storefront interaction tests
│   └── admin/                            # Login and dashboard interaction tests
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc
```

### Task 1: Project foundation and shared contracts

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `wrangler.jsonc`
- Create: `app/main.tsx`
- Create: `app/App.tsx`
- Create: `shared/contracts.ts`
- Create: `shared/validation.ts`
- Create: `worker/index.ts`
- Create: `tests/setup.ts`
- Create: `tests/contracts/validation.test.ts`

**Interfaces:**
- Consumes: the approved design spec only.
- Produces: `Product`, `ProductSummary`, `CatalogueFilters`, `CartLine`, `ValidatedCart`, `ApiError`; Zod schemas `productInputSchema`, `loginSchema`, `cartValidationSchema`; a Worker `fetch` entry point and browser test harness used by every later task.

- [ ] **Step 1: Write the failing validation tests**

```ts
import { describe, expect, it } from "vitest";
import { cartValidationSchema, productInputSchema } from "../../shared/validation";

describe("productInputSchema", () => {
  it("accepts an initial Joygiver product", () => {
    expect(productInputSchema.parse({
      name: "Ivory Two-piece Set",
      description: "Soft structured set",
      priceKobo: 2850000,
      condition: "new",
      categoryId: "cat_sets",
      sizes: ["M", "L"],
      tags: ["office wear"],
      stockQuantity: 2,
      featured: true,
      published: true
    }).condition).toBe("new");
  });

  it("rejects thrifted stock greater than one", () => {
    expect(() => productInputSchema.parse({
      name: "Vintage Gown",
      description: "One available piece",
      priceKobo: 1500000,
      condition: "thrifted",
      categoryId: "cat_gowns",
      sizes: ["M"],
      tags: [],
      stockQuantity: 2,
      featured: false,
      published: true
    })).toThrow();
  });
});

describe("cartValidationSchema", () => {
  it("requires at least one selected line", () => {
    expect(() => cartValidationSchema.parse({ items: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm the project is not configured yet**

Run: `npm test -- tests/contracts/validation.test.ts`

Expected: FAIL because `package.json` and the shared schemas do not exist.

- [ ] **Step 3: Add the minimal application and test configuration**

Use ESM and scripts `dev`, `build`, `test`, `test:watch`, `typecheck`, `cf:typegen`, and `deploy`. Add runtime dependencies `hono`, `react`, `react-dom`, `react-router-dom`, and `zod`; add Vite, the Cloudflare Vite plugin, React plugin, Wrangler, TypeScript, Vitest, jsdom, and Testing Library packages as development dependencies. Configure Vitest with `jsdom`, `tests/setup.ts`, and CSS enabled. Configure Wrangler bindings named `DB`, `PRODUCT_IMAGES`, and `ASSETS`; use compatibility date `2026-09-19` and `not_found_handling: "single-page-application"` for static assets.

Define the central product contract exactly once:

```ts
export type ProductCondition = "new" | "thrifted";
export type ProductState = "available" | "sold" | "hidden";

export interface ProductSummary {
  id: string;
  reference: string;
  slug: string;
  name: string;
  priceKobo: number;
  condition: ProductCondition;
  category: { id: string; name: string; slug: string };
  sizes: string[];
  tags: string[];
  stockQuantity: number;
  state: ProductState;
  soldAt: string | null;
  primaryImage: { url: string; alt: string } | null;
  publishedAt: string;
}

export interface Product extends ProductSummary {
  description: string;
  featured: boolean;
  images: Array<{ id: string; url: string; alt: string; displayOrder: number }>;
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

export interface ValidatedCart {
  valid: ValidatedCartLine[];
  invalid: Array<CartLine & {
    reason: "sold" | "hidden" | "deleted" | "out_of_stock" | "size_unavailable" | "quantity_reduced";
  }>;
  subtotalKobo: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
```

Implement the schemas so prices are positive safe integers, names are 2–120 characters, descriptions are 1–2,000 characters, sizes contain 1–20 unique non-empty values, tags contain at most 20 unique values, New stock is 0–999, and Thrifted stock is 0–1.

- [ ] **Step 4: Run foundation checks**

Run: `npm install && npm test -- tests/contracts/validation.test.ts && npm run typecheck && npm run build`

Expected: validation tests PASS, TypeScript reports no errors, and Vite emits a Worker-compatible production build.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json package-lock.json index.html tsconfig.json vite.config.ts wrangler.jsonc app shared worker tests/setup.ts tests/contracts
git commit -m "build: scaffold Joygiver Cloudflare application"
```

### Task 2: D1 schema and public catalogue queries

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `worker/db/products.ts`
- Create: `worker/db/categories.ts`
- Create: `worker/routes/public.ts`
- Modify: `worker/index.ts`
- Test: `tests/worker/catalogue.test.ts`

**Interfaces:**
- Consumes: `Product`, `ProductSummary`, and `CatalogueFilters` from `shared/contracts.ts`.
- Produces: `listPublicProducts(db, filters, now): Promise<Paginated<ProductSummary>>`, `getPublicProduct(db, slug, now): Promise<Product | null>`, `listActiveCategories(db)`, and routes `GET /api/products`, `GET /api/products/:slug`, `GET /api/categories`.

- [ ] **Step 1: Write failing public catalogue tests**

```ts
it("keeps sold products public before 48 hours and excludes them at the boundary", async () => {
  await seedProduct({ id: "recent", state: "sold", soldAt: "2026-09-18T12:00:01.000Z" });
  await seedProduct({ id: "boundary", state: "sold", soldAt: "2026-09-18T12:00:00.000Z" });
  const result = await listPublicProducts(db, {}, new Date("2026-09-20T12:00:00.000Z"));
  expect(result.items.map((item) => item.id)).toContain("recent");
  expect(result.items.map((item) => item.id)).not.toContain("boundary");
});

it("parameterizes punctuation and wildcard characters in search", async () => {
  await seedProduct({ id: "quoted", name: "Lady's 100% Cotton Gown", state: "available" });
  const result = await listPublicProducts(db, { search: "Lady's 100%" }, new Date());
  expect(result.items.map((item) => item.id)).toEqual(["quoted"]);
});

it("returns latest published products first and caps a home request at eight", async () => {
  const result = await listPublicProducts(db, { sort: "latest", limit: 8 }, new Date());
  expect(result.items).toHaveLength(8);
  expect(Date.parse(result.items[0].publishedAt)).toBeGreaterThanOrEqual(Date.parse(result.items[7].publishedAt));
});
```

- [ ] **Step 2: Run the catalogue tests and verify failure**

Run: `npm test -- tests/worker/catalogue.test.ts`

Expected: FAIL because the migration and catalogue repository do not exist.

- [ ] **Step 3: Create the D1 schema and initial categories**

Create tables `admins`, `sessions`, `login_attempts`, `categories`, `products`, and `product_images`. Use foreign keys, unique indexes for product reference/slug and category slug, indexes on `(published, state, sold_at)`, `(condition, published_at)`, category, and session expiry. Store `sizes_json` and `tags_json` as validated JSON text. Seed the eight agreed categories with stable slugs and display order.

The public predicate must be equivalent to:

```sql
WHERE p.published = 1
  AND (
    p.state = 'available'
    OR (p.state = 'sold' AND p.sold_at > ?)
  )
```

Bind `new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()` as the cutoff. Escape `%`, `_`, and `\\` in search text and use `LIKE ? ESCAPE '\\'` with bound values. Reject unknown conditions, sort values, negative pages, and page sizes above 24 with `400`.

- [ ] **Step 4: Implement the repository and public routes**

Support `condition`, `category`, `size`, `minPriceKobo`, `maxPriceKobo`, `search`, `sort`, `page`, and `limit`. Return `{ items, page, pageSize, total }`. Map D1 rows to contracts in one mapper so JSON parsing and image URL construction are consistent. Product-detail lookup uses the same publication/sold predicate.

- [ ] **Step 5: Run migration and catalogue checks**

Run: `npx wrangler d1 migrations apply DB --local && npm test -- tests/worker/catalogue.test.ts && npm run typecheck`

Expected: migration succeeds, all catalogue tests PASS, and TypeScript reports no errors.

- [ ] **Step 6: Commit public catalogue storage**

```bash
git add migrations worker/db/products.ts worker/db/categories.ts worker/routes/public.ts worker/index.ts tests/worker/catalogue.test.ts
git commit -m "feat: add D1 catalogue and public product API"
```

### Task 3: Owner authentication and session protection

**Files:**
- Create: `worker/lib/password.ts`
- Create: `worker/lib/session.ts`
- Create: `worker/lib/origin.ts`
- Create: `worker/db/auth.ts`
- Create: `worker/routes/auth.ts`
- Modify: `worker/index.ts`
- Test: `tests/worker/auth.test.ts`

**Interfaces:**
- Consumes: `admins`, `sessions`, and `login_attempts` tables from Task 2.
- Produces: local type `Admin = { id: string; email: string }`, `hashPassword(password): Promise<string>`, `verifyPassword(password, stored): Promise<boolean>`, `requireAdmin(c): Promise<Admin>`, `requireSameOrigin(request): boolean`, and routes for bootstrap, login, logout, current session, and password change.

- [ ] **Step 1: Write failing password, session, rate-limit, and origin tests**

```ts
it("verifies the correct password and rejects a different password", async () => {
  const stored = await hashPassword("Owner passphrase 2026!");
  expect(await verifyPassword("Owner passphrase 2026!", stored)).toBe(true);
  expect(await verifyPassword("wrong password", stored)).toBe(false);
});

it("rejects a forged or expired session before a mutation", async () => {
  const response = await request("/api/admin/products", {
    method: "POST",
    headers: { Cookie: "__Host-jc_session=forged", Origin: "https://joygivercollections.com" },
    body: JSON.stringify(validProduct)
  });
  expect(response.status).toBe(401);
  expect(await countProducts()).toBe(0);
});

it("rate limits the sixth failed login inside fifteen minutes", async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) await failedLogin();
  expect((await failedLogin()).status).toBe(429);
});

it("rejects a cross-origin state-changing request", async () => {
  expect((await authenticatedRequest("/api/auth/password", {
    method: "PUT",
    headers: { Origin: "https://attacker.example" },
    body: JSON.stringify({ currentPassword: "Owner passphrase 2026!", newPassword: "New secure passphrase 2026!" })
  })).status).toBe(403);
});
```

- [ ] **Step 2: Run authentication tests and verify failure**

Run: `npm test -- tests/worker/auth.test.ts`

Expected: FAIL because authentication helpers and routes do not exist.

- [ ] **Step 3: Implement PBKDF2 password storage and opaque sessions**

Use Web Crypto PBKDF2-SHA-256 with a random 16-byte salt, 310,000 iterations, and a 32-byte derived key. Store `pbkdf2-sha256$310000$<base64-salt>$<base64-key>` and compare derived keys without early exit. Generate 32 random session bytes, store only their SHA-256 digest in D1, set the raw token in `__Host-jc_session` with `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`, and delete expired sessions during session lookup.

- [ ] **Step 4: Implement owner bootstrap, login, logout, session, and password change**

`POST /api/auth/bootstrap` succeeds only when no admin exists and `Authorization: Bearer <token>` matches the deployment secret `ADMIN_SETUP_TOKEN`; after the first admin exists it always returns `404`. Login records attempts by normalized email and a SHA-256 hash of the client address, permits five failures per rolling 15 minutes, clears failures on success, and returns a generic error for unknown email and wrong password. Password change verifies the current password, updates the hash, and invalidates every other session.

All browser-originated non-GET requests require the request `Origin` to match the request URL origin before reading a body. The bootstrap route may omit `Origin` only when its bearer setup token is valid; if an `Origin` is present, it must still match. Use constant-time byte comparison for setup tokens and password keys.

- [ ] **Step 5: Run authentication checks**

Run: `npm test -- tests/worker/auth.test.ts && npm run typecheck`

Expected: all password, expiry, forged-session, rate-limit, bootstrap, and origin tests PASS.

- [ ] **Step 6: Commit authentication**

```bash
git add worker/lib worker/db/auth.ts worker/routes/auth.ts worker/index.ts tests/worker/auth.test.ts
git commit -m "feat: protect owner dashboard with secure sessions"
```

### Task 4: Admin product, category, image, and sold-state API

**Files:**
- Create: `worker/routes/admin.ts`
- Modify: `worker/db/products.ts`
- Modify: `worker/db/categories.ts`
- Modify: `worker/index.ts`
- Test: `tests/worker/admin-products.test.ts`
- Test: `tests/worker/admin-images.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `productInputSchema`, D1 repositories, and `PRODUCT_IMAGES: R2Bucket`.
- Produces: authenticated summary/category/product CRUD routes, sold/restore/hide actions, image upload/delete/reorder routes, and `POST /api/cart/validate` for canonical price/availability checks.

- [ ] **Step 1: Write failing inventory lifecycle tests**

```ts
it("marks a product sold and restores it without losing inventory metadata", async () => {
  const sold = await adminJson(`/api/admin/products/${productId}/state`, {
    method: "PUT",
    body: { state: "sold" }
  });
  expect(sold.state).toBe("sold");
  expect(sold.soldAt).toMatch(/^2026-/);

  const restored = await adminJson(`/api/admin/products/${productId}/state`, {
    method: "PUT",
    body: { state: "available" }
  });
  expect(restored.soldAt).toBeNull();
  expect(restored.name).toBe(sold.name);
});

it("revalidates price and excludes sold, hidden, and deleted cart lines", async () => {
  const result = await publicJson("/api/cart/validate", {
    method: "POST",
    body: { items: selectedCartLines }
  });
  expect(result.valid.map((line: { productId: string }) => line.productId)).toEqual(["available-repriced"]);
  expect(result.invalid.map((line: { reason: string }) => line.reason).sort()).toEqual(["deleted", "hidden", "sold"]);
  expect(result.valid[0].priceChanged).toBe(true);
});
```

- [ ] **Step 2: Write failing upload-integrity tests**

```ts
it.each([
  ["image/gif", 1024, 415],
  ["image/jpeg", 8 * 1024 * 1024 + 1, 413]
])("rejects invalid upload %s of %d bytes", async (type, size, status) => {
  const response = await uploadImage(new File([new Uint8Array(size)], "photo.jpg", { type }));
  expect(response.status).toBe(status);
  expect(await countImageRows()).toBe(0);
});

it("does not insert image metadata when R2 put fails", async () => {
  r2.put.mockRejectedValueOnce(new Error("R2 unavailable"));
  expect((await uploadImage(validJpeg)).status).toBe(503);
  expect(await countImageRows()).toBe(0);
});
```

- [ ] **Step 3: Run admin API tests and verify failure**

Run: `npm test -- tests/worker/admin-products.test.ts tests/worker/admin-images.test.ts`

Expected: FAIL because admin inventory routes do not exist.

- [ ] **Step 4: Implement authenticated inventory and category routes**

Provide summary counts and paginated full inventory. Validate every mutation. Generate product references as `JGC-` plus eight uppercase hexadecimal characters unless the owner supplies a unique reference. Generate collision-safe slugs. Creating or editing a product must use a D1 transaction/batch for the product and relational metadata. Retiring a category is allowed only after its products have been reassigned; return `409` otherwise. Deletion requires `{ confirmReference }` matching the product reference.

State transitions set `sold_at` only for `sold`, clear it for `available`, and exclude `hidden` immediately. Set `published_at` on the first transition from unpublished to published and preserve it across later edits, unless the owner explicitly republishes through a future feature. Cart validation accepts at most 50 lines, returns canonical names/references/prices/stock, caps thrifted quantity at one, and reports `sold`, `hidden`, `deleted`, `out_of_stock`, `size_unavailable`, or `quantity_reduced` per invalid line.

- [ ] **Step 5: Implement safe R2 image operations**

Read at most six files per product. Verify MIME type from the first bytes as well as the browser-supplied type, limit each to 8 MiB, assign keys `products/<product-id>/<uuid>.<ext>`, and write to R2 before inserting D1 metadata. Stream public media through the wildcard route `GET /media/*` with a long immutable cache header for versioned keys. Decode the suffix once and require an exact matching key in `product_images` before reading R2. For deletion, remove the D1 row only after R2 confirms deletion; return a retryable error if R2 fails. This exact metadata lookup prevents arbitrary bucket-key and path-traversal access.

- [ ] **Step 6: Run API tests**

Run: `npm test -- tests/worker/admin-products.test.ts tests/worker/admin-images.test.ts tests/worker/catalogue.test.ts tests/worker/auth.test.ts && npm run typecheck`

Expected: all API tests PASS with no regression in public sold visibility or authentication.

- [ ] **Step 7: Commit the management API**

```bash
git add worker shared tests/worker
git commit -m "feat: add secure catalogue management API"
```

### Task 5: Brand shell, home page, catalogue, and product detail

**Files:**
- Create: `app/api.ts`
- Create: `app/styles/globals.css`
- Create: `app/styles/components.css`
- Create: `app/components/Layout.tsx`
- Create: `app/components/ProductCard.tsx`
- Create: `app/components/ProductGrid.tsx`
- Create: `app/components/FilterSheet.tsx`
- Create: `app/components/RouteError.tsx`
- Create: `app/pages/HomePage.tsx`
- Create: `app/pages/CataloguePage.tsx`
- Create: `app/pages/ProductPage.tsx`
- Modify: `app/App.tsx`
- Modify: `app/main.tsx`
- Test: `tests/pages/storefront.test.tsx`

**Interfaces:**
- Consumes: public API contracts and routes from Tasks 1–2.
- Produces: routes `/`, `/new`, `/thrifted`, `/product/:slug`; reusable `ProductCard`; URL-backed filters; branded responsive layout.

- [ ] **Step 1: Write failing storefront interaction tests**

```tsx
it("shows eight mixed latest arrivals and explicit condition badges", async () => {
  renderAt("/");
  expect(await screen.findAllByRole("article")).toHaveLength(8);
  expect(screen.getAllByText(/New|Thrifted/)).toHaveLength(8);
});

it("keeps catalogue filters in the URL and sends them to the API", async () => {
  const user = userEvent.setup();
  renderAt("/thrifted");
  await user.click(await screen.findByRole("button", { name: /filter products/i }));
  await user.click(screen.getByRole("checkbox", { name: /mini skirts/i }));
  await user.click(screen.getByRole("button", { name: /apply filters/i }));
  expect(window.location.search).toContain("category=mini-skirts");
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("condition=thrifted"), expect.anything());
});

it("renders a retry action when the catalogue request fails", async () => {
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  renderAt("/new");
  expect(await screen.findByRole("button", { name: /try again/i })).toBeVisible();
});
```

- [ ] **Step 2: Run storefront tests and verify failure**

Run: `npm test -- tests/pages/storefront.test.tsx`

Expected: FAIL because public UI components and routes do not exist.

- [ ] **Step 3: Implement the brand system and responsive shell**

Set CSS tokens for warm white `#FCFBF8`, ivory `#F5F1E8`, charcoal `#22211F`, champagne `#B79A64`, pale border `#E7E0D4`, success `#336B4B`, and danger `#A13E39`. Use an editorial serif stack for headings and a system sans-serif stack for controls. Preserve a minimum 44px touch target, visible `:focus-visible` rings, reduced-motion overrides, fluid spacing, and a two-column mobile product grid that expands at 720px and 1100px.

Create an announcement bar reading `Based in Abuja · Nationwide delivery`, navigation for Home/New/Thrifted, accessible search, cart count, and footer. Add a white-and-champagne `J` monogram favicon and site metadata for Joygiver Collections without adding a social-preview image.

- [ ] **Step 4: Implement home, catalogue, filters, and product detail**

Home requests `sort=latest&limit=8`, mixes New and Thrifted naturally by publication time, and contains the hero, search, latest arrivals, Shop New/Shop Thrifted panels, ordering explanation, and delivery copy. Catalogue routes force their condition from the path, preserve filters/sort/page in URL search parameters, and use a slide-up modal sheet on mobile plus an inline sidebar on desktop. Product detail shows the image gallery, reference, price, size choice, category, tags, condition notes, and disabled sold state.

The API client must normalize non-2xx responses to `{ status, code, message }`, support `AbortSignal`, and never clear rendered results until the replacement request succeeds.

- [ ] **Step 5: Run storefront and accessibility checks**

Run: `npm test -- tests/pages/storefront.test.tsx && npm run typecheck && npm run build`

Expected: storefront tests PASS, TypeScript is clean, and the production build succeeds.

- [ ] **Step 6: Commit the public storefront**

```bash
git add app index.html tests/pages/storefront.test.tsx
git commit -m "feat: build Joygiver public storefront"
```

### Task 6: Persistent selective guest cart and WhatsApp order

**Files:**
- Create: `app/cart/cart-store.ts`
- Create: `app/cart/whatsapp.ts`
- Create: `app/cart/CartPage.tsx`
- Modify: `app/App.tsx`
- Modify: `app/components/Layout.tsx`
- Modify: `app/components/ProductCard.tsx`
- Modify: `app/pages/ProductPage.tsx`
- Test: `tests/cart/cart-store.test.ts`
- Test: `tests/cart/whatsapp.test.ts`
- Test: `tests/cart/cart-page.test.tsx`

**Interfaces:**
- Consumes: `CartLine`, `POST /api/cart/validate`, public product actions.
- Produces: `loadCart()`, `saveCart(lines)`, `upsertCartLine(line)`, `setSelected(productId, selected)`, `buildWhatsAppMessage(order)`, `buildWhatsAppUrl(phone, message)`, and route `/cart`.

- [ ] **Step 1: Write failing cart persistence and migration tests**

```ts
it("persists item selection and restores a versioned cart", () => {
  saveCart([{ ...lineA, selected: false }, { ...lineB, selected: true }]);
  expect(loadCart().map(({ productId, selected }) => ({ productId, selected }))).toEqual([
    { productId: lineA.productId, selected: false },
    { productId: lineB.productId, selected: true }
  ]);
});

it("recovers from corrupt local storage without throwing", () => {
  localStorage.setItem("joygiver-cart", "not-json");
  expect(loadCart()).toEqual([]);
});
```

- [ ] **Step 2: Write failing selective-message and stale-item tests**

```ts
it("includes only selected validated items in the WhatsApp message", () => {
  const message = buildWhatsAppMessage({
    customerName: "Ada",
    deliveryLocation: "Gwarinpa, Abuja",
    items: [selectedGown, selectedJeans],
    subtotalKobo: 4200000
  });
  expect(message).toContain("Ada");
  expect(message).toContain("Gwarinpa, Abuja");
  expect(message).toContain(selectedGown.reference);
  expect(message).toContain(selectedJeans.reference);
  expect(message).not.toContain(unselectedSkirt.reference);
  expect(message).toContain("₩42,000");
});

it("clears selection for an item that becomes unavailable", async () => {
  renderCart([selectedAvailable, selectedNowSold]);
  await screen.findByText(/no longer available/i);
  expect(screen.getByLabelText(selectedNowSold.name)).not.toBeChecked();
  expect(screen.getByRole("button", { name: /order 1 selected item/i })).toBeEnabled();
});
```

- [ ] **Step 3: Run cart tests and verify failure**

Run: `npm test -- tests/cart`

Expected: FAIL because cart storage, WhatsApp formatting, and cart page do not exist.

- [ ] **Step 4: Implement versioned local cart state**

Persist `{ version: 1, lines: CartLine[] }` under `joygiver-cart`. Treat malformed or future-version data as an empty cart. Merge a repeated product/size line, cap Thrifted quantity at one, expose selection helpers, and synchronize changes across open tabs through the browser `storage` event.

- [ ] **Step 5: Implement selective checkout and deterministic WhatsApp formatting**

The cart page provides per-item checkboxes, Select All, Clear Selection, quantity controls, removal, selected subtotal, customer name, and delivery location. Before enabling the final link, send only selected lines to `/api/cart/validate`, apply canonical prices and allowed quantities, unselect unavailable lines, and show each change. Build one message with this stable shape:

```text
Hello Joygiver Collections, I would like to order these items:

1. Ivory Two-piece Set (JGC-A1B2C3D4)
   Size: M | Qty: 1 | Price: ₩28,500

Selected items subtotal: ₩28,500
Customer: Ada
Delivery location: Gwarinpa, Abuja

Please confirm availability and the nationwide delivery fee. I understand this request is not a reservation until confirmed.
```

Normalize the configured WhatsApp number to digits only and build `https://wa.me/<digits>?text=<encoded-message>`. Do not remove items or mark stock sold when the link opens.

- [ ] **Step 6: Run cart and storefront checks**

Run: `npm test -- tests/cart tests/pages/storefront.test.tsx && npm run typecheck && npm run build`

Expected: cart, selective message, stale-product, and storefront tests PASS.

- [ ] **Step 7: Commit guest ordering**

```bash
git add app/cart app/App.tsx app/components app/pages tests/cart
git commit -m "feat: add selective WhatsApp guest checkout"
```

### Task 7: Owner dashboard user interface

**Files:**
- Create: `app/admin/LoginPage.tsx`
- Create: `app/admin/AdminLayout.tsx`
- Create: `app/admin/DashboardPage.tsx`
- Create: `app/admin/ProductsPage.tsx`
- Create: `app/admin/ProductForm.tsx`
- Create: `app/admin/CategoriesPage.tsx`
- Create: `app/admin/AccountPage.tsx`
- Modify: `app/App.tsx`
- Modify: `app/api.ts`
- Test: `tests/admin/login.test.tsx`
- Test: `tests/admin/products.test.tsx`
- Test: `tests/admin/product-form.test.tsx`

**Interfaces:**
- Consumes: authentication and admin API routes from Tasks 3–4.
- Produces: routes `/owner/login`, `/owner`, `/owner/products`, `/owner/products/new`, `/owner/products/:id`, `/owner/categories`, and `/owner/account`.

- [ ] **Step 1: Write failing login and route-protection tests**

```tsx
it("redirects an unauthenticated dashboard visit to owner login", async () => {
  renderAt("/owner/products");
  expect(await screen.findByRole("heading", { name: /owner login/i })).toBeVisible();
});

it("shows a generic message for invalid credentials", async () => {
  const user = userEvent.setup();
  renderAt("/owner/login");
  await user.type(screen.getByLabelText(/email/i), "owner@example.com");
  await user.type(screen.getByLabelText(/password/i), "incorrect password");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText(/email or password is incorrect/i)).toBeVisible();
});
```

- [ ] **Step 2: Write failing product-management tests**

```tsx
it("retains product fields and identifies the failed image after upload failure", async () => {
  renderProductForm();
  await fillValidProduct({ name: "Champagne Maxi Skirt" });
  await attachFiles([validJpeg, oversizedJpeg]);
  await submit();
  expect(screen.getByLabelText(/product name/i)).toHaveValue("Champagne Maxi Skirt");
  expect(await screen.findByText(/oversized.jpg could not be uploaded/i)).toBeVisible();
});

it("requires the reference before deleting a product", async () => {
  renderProductsPage();
  await openDeleteDialog("JGC-A1B2C3D4");
  expect(screen.getByRole("button", { name: /delete permanently/i })).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/type product reference/i), "JGC-A1B2C3D4");
  expect(screen.getByRole("button", { name: /delete permanently/i })).toBeEnabled();
});
```

- [ ] **Step 3: Run dashboard tests and verify failure**

Run: `npm test -- tests/admin`

Expected: FAIL because owner pages do not exist.

- [ ] **Step 4: Implement authenticated dashboard routing and overview**

Resolve `/api/auth/session` before rendering protected pages, redirect `401` responses to `/owner/login`, and preserve the intended route for post-login navigation. The overview shows total, available, sold, New, and Thrifted counts and direct actions for adding a product and viewing inventory. Use the public brand tokens with denser dashboard spacing rather than creating a separate visual identity.

- [ ] **Step 5: Implement product and category management**

Product list supports owner search, condition/state/category filters, pagination, edit, mark sold, restore, hide, and confirmed deletion. The form supports multiple images with previews and ordering, exact shared validation, category selection, size chips, tag chips, New/Thrifted, price in naira converted safely to kobo, stock, feature, and publish controls. Upload images only after the product record exists; show per-file progress and retain all form fields on partial failure.

Categories support create, rename, display ordering, and retirement. When retirement returns `409`, show the number of products that must be reassigned. Account settings verify current password and require the new password twice.

- [ ] **Step 6: Run dashboard checks**

Run: `npm test -- tests/admin && npm run typecheck && npm run build`

Expected: login, route protection, form retention, image failure, inventory actions, delete confirmation, categories, and password-change tests PASS.

- [ ] **Step 7: Commit the owner dashboard**

```bash
git add app/admin app/App.tsx app/api.ts tests/admin
git commit -m "feat: add Joygiver owner dashboard"
```

### Task 8: End-to-end integration, accessibility, and resilience

**Files:**
- Modify: `app/styles/globals.css`
- Modify: `app/styles/components.css`
- Modify: `app/components/FilterSheet.tsx`
- Modify: `app/cart/CartPage.tsx`
- Modify: `app/admin/ProductForm.tsx`
- Modify: `worker/index.ts`
- Create: `tests/integration/shop-flow.test.tsx`
- Create: `tests/integration/sold-lifecycle.test.ts`
- Create: `tests/integration/accessibility.test.tsx`

**Interfaces:**
- Consumes: all public, cart, authentication, and admin interfaces.
- Produces: one verified cross-feature shopping flow, complete loading/empty/offline/error handling, and responsive/accessibility hardening.

- [ ] **Step 1: Write failing cross-feature tests**

```tsx
it("searches, adds two products, selects one, and prepares one-item WhatsApp order", async () => {
  renderAt("/");
  await searchFor("gown");
  await addProduct("Emerald Gown", "M");
  await addProduct("Ivory Gown", "L");
  await openCart();
  await clearSelection();
  await selectCartItem("Emerald Gown");
  await enterDeliveryDetails("Ada", "Wuse 2, Abuja");
  const link = await screen.findByRole("link", { name: /order 1 selected item on whatsapp/i });
  expect(decodeURIComponent(link.getAttribute("href")!)).toContain("Emerald Gown");
  expect(decodeURIComponent(link.getAttribute("href")!)).not.toContain("Ivory Gown");
});

it("preserves the cart when catalogue loading fails", async () => {
  seedLocalCart([selectedGown]);
  failNextCatalogueRequest();
  renderAt("/new");
  await screen.findByRole("button", { name: /try again/i });
  expect(readLocalCart()).toEqual(expect.arrayContaining([expect.objectContaining({ productId: selectedGown.productId })]));
});
```

- [ ] **Step 2: Add sold-lifecycle and keyboard tests**

Test a product at 47:59:59 as visible/sold, at exactly 48:00:00 as absent publicly, and present in the owner API at both times. Test keyboard opening/closing of the filter sheet, focus return to its trigger, labelled cart checkboxes, visible focus styles, meaningful image alternative text, and `prefers-reduced-motion` disabling nonessential transitions.

- [ ] **Step 3: Run integration tests and verify the gaps**

Run: `npm test -- tests/integration`

Expected: at least one failure exposes missing cross-feature or accessibility behaviour before hardening.

- [ ] **Step 4: Complete resilient states and responsive behaviour**

Add skeletons that preserve layout, specific empty states for no products/no search matches/empty cart, retryable offline errors, `aria-live` announcements for cart and filter changes, focus trapping in modal filter and delete confirmations, body scroll locking for open sheets, and form-level plus field-level validation summaries. Verify 320px, 390px, 768px, 1024px, and 1440px layouts with no horizontal overflow.

- [ ] **Step 5: Run the complete local verification suite**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests PASS, TypeScript reports no errors, and the production build succeeds.

- [ ] **Step 6: Commit integration hardening**

```bash
git add app worker tests/integration
git commit -m "test: verify storefront and dashboard integration"
```

### Task 9: Cloudflare provisioning, owner creation, and production smoke test

**Files:**
- Modify: `wrangler.jsonc`
- Create: `scripts/smoke-production.mjs`
- Create: `.env.example`
- Modify: `package.json`
- Create: `README.md`
- Test: `scripts/smoke-production.mjs`

**Interfaces:**
- Consumes: the production Worker, D1 migration, R2 binding, `ADMIN_SETUP_TOKEN`, business WhatsApp number, and owner bootstrap route.
- Produces: deployed `joygivercollections.com`, initialized owner account, documented operational workflow, and a repeatable read-only production smoke check.

- [ ] **Step 1: Write the production smoke script before deployment**

```js
const base = process.env.SMOKE_BASE_URL;
if (!base) throw new Error("SMOKE_BASE_URL is required");

const checks = ["/", "/new", "/thrifted", "/api/categories", "/api/products?limit=1"];
for (const path of checks) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

const protectedResponse = await fetch(new URL("/api/admin/summary", base));
if (protectedResponse.status !== 401) {
  throw new Error(`protected route returned ${protectedResponse.status}, expected 401`);
}
console.log("Production smoke checks passed");
```

- [ ] **Step 2: Run the smoke script and verify it fails before deployment**

Run: `$env:SMOKE_BASE_URL='https://joygivercollections.com'; node scripts/smoke-production.mjs`

Expected: FAIL because the production application has not been deployed yet.

- [ ] **Step 3: Provision production resources and configure bindings**

Create D1 database `joygiver-store` and R2 bucket `joygiver-product-images` in the selected Cloudflare account. Insert the returned D1 identifier into the `DB` binding, set the R2 binding to the exact bucket name, set `WHATSAPP_NUMBER` as a non-secret environment value, and store a newly generated 32-byte `ADMIN_SETUP_TOKEN` as a Worker secret. Apply `migrations/0001_initial.sql` to the remote D1 database. Do not commit any secret value or owner password.

- [ ] **Step 4: Build, deploy, bind the custom domain, and create the owner**

Run the complete tests and production build, deploy the Worker, attach `joygivercollections.com`, and call the one-time bootstrap endpoint over HTTPS with the setup token, the owner’s real email, and a strong owner-supplied password. Confirm the endpoint returns success once and `404` on a second call. Remove or rotate the setup secret after owner creation.

- [ ] **Step 5: Run production verification**

Run: `$env:SMOKE_BASE_URL='https://joygivercollections.com'; node scripts/smoke-production.mjs`

Expected: `Production smoke checks passed`.

Manually verify owner login, one image upload, product publication, guest cart persistence after refresh, selection of one item from a two-item cart, WhatsApp message contents, marking the test product sold, disabled ordering while sold, and owner-only visibility after testing with a controlled 48-hour timestamp in a non-production test record.

- [ ] **Step 6: Document operations and commit deployment configuration**

Document owner tasks for adding products, marking sold, restoring mistakes, hiding, deleting, managing categories, and changing the password. Document deployment, migration, resource binding, backup/export, and secret rotation commands without including credentials.

```bash
git add wrangler.jsonc scripts/smoke-production.mjs .env.example package.json README.md
git commit -m "docs: add Cloudflare deployment and store operations"
```

### Task 10: Final regression and launch review

**Files:**
- Modify: only files required by defects found during this task
- Test: all tests and production smoke checks

**Interfaces:**
- Consumes: the complete deployed system.
- Produces: launch-ready Joygiver Collections storefront and owner dashboard.

- [ ] **Step 1: Run the clean regression suite**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests PASS from a clean checkout and the production build succeeds.

- [ ] **Step 2: Verify the launch journeys**

Verify on a phone-sized viewport and desktop viewport: home search, New catalogue, Thrifted catalogue, every initial category filter, product detail, multi-item cart, per-item selection, revalidation, generated WhatsApp text, sold badge, owner login, product create/edit/sold/restore/hide/delete, category management, image ordering, and password change. Confirm no customer account or payment UI appears.

- [ ] **Step 3: Verify production safety and metadata**

Confirm HTTPS, secure session-cookie attributes, rejected cross-origin mutations, `401` for unauthenticated admin routes, rate-limited login failures, private R2 mutation paths, correct Joygiver title/description/favicon, Abuja and nationwide-delivery copy, and no secrets in the client bundle or repository.

- [ ] **Step 4: Run the production smoke test once more**

Run: `$env:SMOKE_BASE_URL='https://joygivercollections.com'; node scripts/smoke-production.mjs`

Expected: `Production smoke checks passed`.

- [ ] **Step 5: Commit only if launch review required fixes**

```bash
git add -A
git commit -m "fix: resolve Joygiver launch review findings"
```

Skip this commit when the working tree is clean.
