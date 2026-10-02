# Joygiver Family Catalogue, Promotions, and Wholesale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Joygiver Collections into a production-ready Women, Men, and Kids storefront with audience-aware New and Thrifted catalogues, wholesale packages, scheduled full-group percentage promotions, owner-managed branding, and one selective guest cart that produces a server-validated WhatsApp order.

**Architecture:** Extend the current React 19 + Hono Worker application in place. Add normalized D1 relationships and focused Worker data modules, keep R2 behind authenticated upload routes, expose typed public/admin JSON APIs, and migrate the browser cart to a discriminated union while preserving legacy retail carts. Promotion totals remain server-authoritative and are computed by one pure calculator shared by cart validation and API presentation.

**Tech Stack:** TypeScript 5.9, React 19, React Router 7, Hono 4, Zod 4, Cloudflare Workers, D1, R2, Vite 7, Vitest 4, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-joygiver-family-catalogue-promotions-wholesale-design.md`

## Global Constraints

- Public audience labels are `Women`, `Men`, and `Kids`.
- New and Thrifted remain the primary retail collection choices.
- Unisex is a product badge and owner-managed placement property, not a standalone public collection or filter.
- Existing Thrifted stock remains limited to one unit.
- Only one promotion may be active at any instant.
- The dashboard displays and accepts promotion times in Africa/Lagos time. D1 stores normalized UTC timestamps.
- A promotion is active only when it is not paused and the current time is greater than or equal to its start time and strictly earlier than its end time.
- One wholesale package quantity counts as one cart unit, regardless of how many garments are inside.
- Existing products receive Women as their initial audience placement.
- Existing versioned carts without `itemType` migrate safely as retail lines. Unknown future cart versions still reset safely.
- Sold ordering stops immediately; sold retail products and wholesale packages remain public for 48 hours and disappear at the exact boundary.
- Site assets accept JPEG, PNG, and WebP under the existing 8 MB image limit; a failed replacement leaves the current asset active.
- Mobile touch targets remain at least 44 pixels where practical.
- Do not use italic type anywhere on the site; keep the editorial surfaces squared rather than reintroducing rounded cards.
- No customer accounts, card payments, stored orders, delivery-fee calculation, stock reservation, coupon codes, or simultaneous active promotions are added.
- Use Node.js 24 or newer and do not add a new runtime dependency unless the existing platform and libraries cannot implement the requirement.

## Review Focus

1. A product whose clothing type is not assigned to every chosen audience must be rejected without partially changing its existing audience rows; Task 2 adds an update rollback test.
2. Promotion calculations around exact boundaries (start inclusive, end exclusive; quantities 5/6/7/11/12/18) must stay deterministic with mixed prices; Task 6 adds table-driven clock and calculator tests.
3. A legacy version-1 cart must migrate to retail while malformed and future versions fail closed without deleting a later valid save; Task 7 adds storage migration and recovery tests.
4. A logo or hero upload that reaches R2 but fails before the D1 setting commits must preserve the active asset and remove the orphaned replacement; Task 8 injects a D1 failure and verifies both stores.
5. A wholesale package sold at exactly 48 hours must disappear, and its internal piece count must never increase promotion quantity; Tasks 4 and 7 add boundary and mixed-cart tests.

---

## File Structure

### Shared contracts and validation

- Modify `shared/contracts.ts` — define audiences, audience-aware retail/category models, wholesale models, promotion models, the cart-line union, and authoritative validated-cart totals.
- Modify `shared/validation.ts` — validate product audiences, wholesale package input, promotion schedules/discounts, site copy, and mixed cart lines.

### Worker and storage

- Create `migrations/0002_family_catalogue_promotions_wholesale.sql` — additive schema, initial audience/type assignments, and Women backfill for existing products.
- Modify `worker/db/products.ts` — audience joins, Unisex state, audience/category filtering, and atomic audience writes.
- Modify `worker/db/categories.ts` — audience-aware clothing-type reads/writes and in-use conflict rules.
- Create `worker/db/wholesale.ts` — wholesale CRUD, public lifecycle queries, image metadata, and cart lookup.
- Create `worker/db/promotions.ts` — promotion persistence, overlap detection, active-promotion lookup, and eligibility joins.
- Create `worker/db/site-settings.ts` — singleton public settings and atomic asset-key swaps.
- Create `worker/lib/promotions.ts` — pure complete-group discount allocation.
- Create `worker/lib/images.ts` — shared image validation, R2 object naming, upload, delete, and media registration helpers used by product/package/site assets.
- Modify `worker/routes/public.ts` — audience catalogue, clothing types, wholesale, active promotion, settings, and mixed cart validation endpoints.
- Modify `worker/routes/admin.ts` — owner CRUD for audiences, wholesale, promotions, clothing types, and site settings.
- Modify `worker/index.ts` — serve registered retail, wholesale, and site assets from the existing `/media/*` route.

### Storefront and cart

- Modify `app/api.ts` — typed public/admin API functions for all new resources.
- Modify `app/App.tsx` — audience routes, wholesale routes, and owner pages.
- Modify `app/pages/HomePage.tsx` — family copy, current settings, active promotion announcement, and wholesale entry.
- Modify `app/pages/CataloguePage.tsx` — condition + audience route state and audience-scoped clothing types.
- Create `app/pages/WholesalePage.tsx` — package catalogue and filters.
- Create `app/pages/WholesaleDetailPage.tsx` — package details and add-package action.
- Modify `app/pages/ProductPage.tsx` — audience, Unisex, and promotion states.
- Modify `app/components/ProductCard.tsx` — audience/Unisex/promotion badges and retail cart line creation.
- Create `app/components/AudienceTabs.tsx` — keyboard-operable Women/Men/Kids links.
- Create `app/components/WholesaleCard.tsx` — representative package card.
- Modify `app/components/FilterSheet.tsx` — consume only clothing types for the active audience.
- Modify `app/components/Layout.tsx` and `app/components/MobileMenu.tsx` — approved desktop/mobile navigation and server-provided logo.
- Modify `app/cart/cart-store.ts` — version-2 union storage and version-1 migration.
- Modify `app/cart/CartPage.tsx` — retail/wholesale line rendering, promotion progress, authoritative totals, and reconciliation notices.
- Modify `app/cart/whatsapp.ts` — retail/package lines and promotion breakdown.
- Modify `app/config.ts` — static fallbacks only; runtime settings come from the API.
- Modify `app/styles/globals.css` and `app/styles/components.css` — responsive family hero, badges, tabs, wholesale, promotions, settings, and reduced motion.

### Owner dashboard

- Modify `app/admin/AdminLayout.tsx` — Overview, Products, Wholesale, Promotions, Clothing Types, Site Settings, Account.
- Modify `app/admin/ProductForm.tsx` and `app/admin/ProductsPage.tsx` — audience placement, Unisex toggle, and richer filtering.
- Modify `app/admin/CategoriesPage.tsx` — clothing-type audience assignments and revised language.
- Create `app/admin/WholesalePage.tsx` and `app/admin/WholesaleForm.tsx` — package inventory CRUD and images.
- Create `app/admin/PromotionsPage.tsx` and `app/admin/PromotionForm.tsx` — schedules, pause/resume, eligible-item selection, and rule preview.
- Create `app/admin/SiteSettingsPage.tsx` — logo/hero replacement and hero copy.
- Modify `app/admin/DashboardPage.tsx` — audience, wholesale, and current/next promotion summary.

### Tests, assets, and operations

- Add focused tests under `tests/contracts`, `tests/worker`, `tests/pages`, `tests/cart`, `tests/admin`, and `tests/integration` alongside the owning feature.
- Create `public/brand/joygiver-logo.jpeg` from the supplied logo and `public/brand/family-hero.png` from the approved hero concept as runtime-safe fallbacks.
- Modify `scripts/smoke-production.mjs` — exercise family catalogue, settings, wholesale, and active-promotion public endpoints.
- Modify `README.md` — document migration order, owner workflows, staging verification, asset fallback, and rollback procedure.

### Task 1: Add the additive family-commerce schema and shared contracts

**Files:**
- Create: `migrations/0002_family_catalogue_promotions_wholesale.sql`
- Modify: `shared/contracts.ts`
- Modify: `shared/validation.ts`
- Modify: `tests/worker/helpers.ts`
- Create: `tests/worker/migration-family.test.ts`
- Modify: `tests/contracts/validation.test.ts`

**Interfaces:**
- Consumes: existing `ProductCondition`, `ProductState`, `ProductInput`, D1 migrations, and the `PRODUCT_IMAGES` R2 binding.
- Produces: `Audience`, `ProductSummary.audiences`, `ProductSummary.isUnisex`, `AdminCategory.audiences`, `WholesalePackage*`, `Promotion*`, `SiteSettings`, `CartLine`, `ValidatedCart`, `wholesalePackageInputSchema`, `promotionInputSchema`, and `siteSettingsInputSchema`.

- [ ] **Step 1: Write failing contract-validation tests**

```ts
it("requires at least one audience and a compatible clothing type", () => {
  expect(productInputSchema.safeParse({ ...validProductInput, audiences: [] }).success).toBe(false);
  expect(productInputSchema.safeParse({ ...validProductInput, audiences: ["women"], isUnisex: false }).success).toBe(true);
});

it("rejects invalid promotion ranges", () => {
  expect(promotionInputSchema.safeParse({
    name: "Six-piece edit", description: "", requiredQuantity: 6,
    discountBasisPoints: 1500, startAt: "2026-10-01T09:00:00.000Z",
    endAt: "2026-10-01T08:59:59.000Z", paused: false,
    productIds: [], wholesalePackageIds: [],
  }).success).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and confirm missing exports**

Run: `npm run test:dom -- tests/contracts/validation.test.ts`

Expected: FAIL because `promotionInputSchema` and the new audience fields do not exist.

- [ ] **Step 3: Add exact shared types and discriminated cart contracts**

```ts
export type Audience = "women" | "men" | "kids";
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
  itemType: "retail";
  productId: string;
  size: string;
}

export interface WholesaleCartLine extends CartLineBase {
  itemType: "wholesale";
  packageId: string;
}

export type CartLine = RetailCartLine | WholesaleCartLine;

export type ValidatedCartLine = CartLine & {
  canonicalPriceKobo: number;
  priceChanged: boolean;
  discountedQuantity: number;
  discountKobo: number;
};

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
  regularSubtotalKobo: number;
  promotion: PromotionBreakdown | null;
  finalSubtotalKobo: number;
}
```

- [ ] **Step 4: Add Zod schemas with bounded IDs, UTC timestamps, basis points, and audience arrays**

```ts
export const audienceSchema = z.enum(["women", "men", "kids"]);
export const promotionInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  requiredQuantity: z.number().int().min(2).max(100),
  discountBasisPoints: z.number().int().min(1).max(9_900),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  paused: z.boolean(),
  productIds: uniqueTrimmedStrings(0, 500),
  wholesalePackageIds: uniqueTrimmedStrings(0, 500),
}).refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
  path: ["endAt"], message: "End time must be later than start time",
});
```

- [ ] **Step 5: Write a migration test that checks backfill and reusable type assignments**

```ts
it("backfills existing products to Women and shares reusable clothing types", async () => {
  const productAudience = await env.DB.prepare(
    "SELECT audience FROM product_audiences WHERE product_id = ?",
  ).bind("legacy-product").first<{ audience: string }>();
  const jeans = await env.DB.prepare(
    "SELECT audience FROM category_audiences WHERE category_id = 'cat_jeans' ORDER BY audience",
  ).all<{ audience: string }>();
  expect(productAudience?.audience).toBe("women");
  expect(jeans.results.map((row) => row.audience)).toEqual(["kids", "men", "women"]);
});
```

In this test file only, call `applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, 1))`, insert `legacy-product` with the version-1 columns, then call `applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(1))` before the assertions. This proves the real upgrade path instead of testing a post-migration insert.

- [ ] **Step 6: Create the additive migration**

The migration must add `products.is_unisex`, `product_audiences`, `category_audiences`, `wholesale_packages`, `wholesale_package_audiences`, `wholesale_package_categories`, `wholesale_package_images`, `promotions`, `promotion_products`, `promotion_wholesale_packages`, and singleton `site_settings`. Use foreign keys with `ON DELETE CASCADE` for join/image rows, `CHECK` constraints for enum and boolean values, and indexes for public state/schedule queries. Insert missing Men/Kids clothing types with stable `cat_*` IDs, assign the approved audience combinations, and execute:

```sql
INSERT OR IGNORE INTO product_audiences (product_id, audience)
SELECT id, 'women' FROM products;
```

- [ ] **Step 7: Reset all new tables in the Worker test helper and provide valid audience defaults**

Delete eligibility rows before promotions, package images/joins before packages, and audience rows before products. Extend `validProductInput` with `audiences: ["women"]` and `isUnisex: false`.

- [ ] **Step 8: Run migration, contract, and type checks**

Run: `npm run test:worker -- tests/worker/migration-family.test.ts && npm run test:dom -- tests/contracts/validation.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit the data foundation**

```bash
git add migrations/0002_family_catalogue_promotions_wholesale.sql shared/contracts.ts shared/validation.ts tests/worker/helpers.ts tests/worker/migration-family.test.ts tests/contracts/validation.test.ts
git commit -m "feat: add family commerce data model"
```

### Task 2: Make retail products and clothing types audience-aware

**Files:**
- Modify: `worker/db/products.ts`
- Modify: `worker/db/categories.ts`
- Modify: `worker/routes/public.ts`
- Modify: `worker/routes/admin.ts`
- Modify: `tests/worker/catalogue.test.ts`
- Modify: `tests/worker/admin-products.test.ts`
- Create: `tests/worker/admin-categories-audiences.test.ts`

**Interfaces:**
- Consumes: `Audience`, `ProductInput.audiences`, `ProductInput.isUnisex`, and the Task 1 joins.
- Produces: `listPublicProducts(db, filters, now)`, `getPublicProduct(db, slug, now)`, and product/category admin CRUD that round-trip audiences atomically; `GET /api/categories?audience=women|men|kids`.

- [ ] **Step 1: Write public-query tests for audience isolation and Unisex placement**

```ts
it("shows a Unisex product only in owner-selected audience pages", async () => {
  const product = await createProduct({ audiences: ["women", "men"], isUnisex: true });
  const women = await apiRequest("/api/products?condition=new&audience=women").then((r) => r.json());
  const men = await apiRequest("/api/products?condition=new&audience=men").then((r) => r.json());
  const kids = await apiRequest("/api/products?condition=new&audience=kids").then((r) => r.json());
  expect(women.items[0]).toMatchObject({ id: product.id, isUnisex: true });
  expect(men.items[0].id).toBe(product.id);
  expect(kids.items).toEqual([]);
});
```

- [ ] **Step 2: Write the review-focus atomic update test**

Create a Women product using `Mini Skirts`, attempt to update it to `audiences: ["men"]`, expect `409 clothing_type_audience_conflict`, then fetch the product and assert its name, category, and `["women"]` placement are unchanged.

- [ ] **Step 3: Run the retail Worker tests and confirm they fail**

Run: `npm run test:worker -- tests/worker/catalogue.test.ts tests/worker/admin-products.test.ts tests/worker/admin-categories-audiences.test.ts`

Expected: FAIL because audience joins and validation are not implemented.

- [ ] **Step 4: Add audience-aware reads without row multiplication**

Use `EXISTS` for filtering and a correlated JSON aggregate for output:

```sql
AND EXISTS (
  SELECT 1 FROM product_audiences pa
  WHERE pa.product_id = p.id AND pa.audience = ?
)
```

Map a separate `audiences_json` column through the existing guarded JSON parser. Keep the sold predicate unchanged so exactly 48 hours remains excluded.

- [ ] **Step 5: Add atomic product audience writes**

Before any insert/update, query `category_audiences` for the selected category and verify every requested product audience is present. Use `db.batch` for the product write, deletion of old `product_audiences`, and insertion of the complete new set. Store `is_unisex` on `products` and never derive placement from it.

- [ ] **Step 6: Add clothing-type audience CRUD and conflict responses**

Expose `audiences` on each admin category. When removing an audience, reject if a product using that category is still placed in that audience. Public category reads accept one validated audience and return only active matching types.

- [ ] **Step 7: Validate route queries and request bodies**

Add `audience: audienceSchema.optional()` to product queries. Return stable `400 invalid_audience` for `audience=adult` and `409 clothing_type_audience_conflict` for incompatible admin writes; do not pass unknown strings into SQL.

- [ ] **Step 8: Run the focused and regression Worker suites**

Run: `npm run test:worker -- tests/worker/catalogue.test.ts tests/worker/admin-products.test.ts tests/worker/admin-categories-audiences.test.ts tests/worker/integration-sold-lifecycle.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit audience-aware retail storage**

```bash
git add worker/db/products.ts worker/db/categories.ts worker/routes/public.ts worker/routes/admin.ts tests/worker/catalogue.test.ts tests/worker/admin-products.test.ts tests/worker/admin-categories-audiences.test.ts
git commit -m "feat: add audience-aware retail catalogue"
```

### Task 3: Add audience storefront routes and retail owner controls

**Files:**
- Modify: `app/api.ts`
- Modify: `app/App.tsx`
- Modify: `app/pages/CataloguePage.tsx`
- Modify: `app/pages/ProductPage.tsx`
- Modify: `app/components/ProductCard.tsx`
- Modify: `app/components/FilterSheet.tsx`
- Create: `app/components/AudienceTabs.tsx`
- Modify: `app/admin/ProductForm.tsx`
- Modify: `app/admin/ProductsPage.tsx`
- Modify: `app/admin/CategoriesPage.tsx`
- Modify: `tests/pages/storefront.test.tsx`
- Modify: `tests/admin/product-form.test.tsx`
- Modify: `tests/admin/settings.test.tsx`

**Interfaces:**
- Consumes: Task 2 public/admin endpoints and audience fields.
- Produces: `/new/:audience`, `/thrifted/:audience`, audience-scoped filter UI, textual Unisex labels, and owner audience assignment forms.

- [ ] **Step 1: Write failing route and form tests**

```tsx
it("keeps condition first and switches audience with shareable links", async () => {
  renderAppAt("/new/men");
  expect(await screen.findByRole("heading", { name: /new for men/i })).toBeVisible();
  expect(screen.getByRole("link", { name: "Women" })).toHaveAttribute("href", "/new/women");
  expect(screen.getByRole("link", { name: "Kids" })).toHaveAttribute("href", "/new/kids");
});

it("requires an owner to choose an audience", async () => {
  render(<ProductForm />);
  await user.click(screen.getByRole("button", { name: /save product/i }));
  expect(await screen.findByText(/choose at least one audience/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the DOM tests and confirm the new routes are absent**

Run: `npm run test:dom -- tests/pages/storefront.test.tsx tests/admin/product-form.test.tsx tests/admin/settings.test.tsx`

Expected: FAIL on route heading, audience links, and owner controls.

- [ ] **Step 3: Extend API query serialization and admin methods**

Serialize `filters.audience` in `buildProductQuery`, pass audience to `getCategories`, and type admin create/update payloads with Task 1 schemas. Preserve the global `/search` route with optional audience narrowing.

- [ ] **Step 4: Add canonical retail routes and redirects**

```tsx
<Route path="new" element={<Navigate to="/new/women" replace />} />
<Route path="new/:audience" element={<CataloguePage condition="new" />} />
<Route path="thrifted" element={<Navigate to="/thrifted/women" replace />} />
<Route path="thrifted/:audience" element={<CataloguePage condition="thrifted" />} />
```

Reject unknown route audiences by redirecting to the matching Women page before fetching.

- [ ] **Step 5: Build `AudienceTabs` as links with current-page semantics**

Render Women, Men, and Kids links, apply `aria-current="page"` to the active audience, and keep the condition segment unchanged. CSS motion belongs to Task 9; semantic navigation works without animation.

- [ ] **Step 6: Scope catalogue types and reset incompatible filters**

Fetch `/api/categories?audience=<active>`. When the audience changes, remove `category` and reset `page=1`; preserve search, price, size, and sort. Heading copy uses `New for Women`, `Thrifted for Men`, and analogous forms.

- [ ] **Step 7: Render textual audience, Unisex, and condition states**

Add the Unisex badge only when `product.isUnisex` is true. Product details list the selected audience placements. Quick add creates `itemType: "retail"` lines.

- [ ] **Step 8: Add owner audience controls**

Product forms use three checkboxes plus a separate `Show Unisex badge` switch. Clothing Types replaces Categories in copy and allows Women/Men/Kids assignments; disable save only while submitting and show server conflict messages without clearing edits.

- [ ] **Step 9: Run retail UI tests and typecheck**

Run: `npm run test:dom -- tests/pages/storefront.test.tsx tests/admin/product-form.test.tsx tests/admin/settings.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 10: Commit the retail experience**

```bash
git add app/api.ts app/App.tsx app/pages/CataloguePage.tsx app/pages/ProductPage.tsx app/components/ProductCard.tsx app/components/FilterSheet.tsx app/components/AudienceTabs.tsx app/admin/ProductForm.tsx app/admin/ProductsPage.tsx app/admin/CategoriesPage.tsx tests/pages/storefront.test.tsx tests/admin/product-form.test.tsx tests/admin/settings.test.tsx
git commit -m "feat: add family retail storefront"
```

### Task 4: Build wholesale storage, lifecycle, and APIs

**Files:**
- Create: `worker/db/wholesale.ts`
- Create: `tests/worker/wholesale.test.ts`
- Create: `tests/worker/admin-wholesale.test.ts`
- Modify: `worker/lib/images.ts`
- Modify: `worker/db/products.ts`
- Modify: `worker/routes/public.ts`
- Modify: `worker/routes/admin.ts`
- Modify: `worker/index.ts`
- Modify: `tests/worker/admin-images.test.ts`

**Interfaces:**
- Consumes: Task 1 wholesale tables/types/schema and existing authenticated/same-origin middleware.
- Produces: `listPublicWholesale`, `getPublicWholesalePackage`, `getWholesaleForCart`, complete admin CRUD/image functions, `GET /api/wholesale`, `GET /api/wholesale/:slug`, and `/api/admin/wholesale*`.

- [ ] **Step 1: Write public lifecycle and filter tests**

Test audience scope, mixed condition, clothing type, piece-count range, price range, literal wildcard search, and the review-focus sold boundary. At `soldAt + 47:59:59` the package is public with `state: "sold"`; at exactly `soldAt + 48:00:00` it is absent.

- [ ] **Step 2: Write admin authorization and image integrity tests**

Assert unauthenticated and cross-origin mutations fail, partial invalid image uploads name the rejected file, deleting a package removes registered R2 images, and the response never exposes an internal-garment list.

- [ ] **Step 3: Run wholesale Worker tests and confirm missing routes**

Run: `npm run test:worker -- tests/worker/wholesale.test.ts tests/worker/admin-wholesale.test.ts`

Expected: FAIL with `404` for wholesale routes.

- [ ] **Step 4: Extract shared image primitives**

Move MIME/size checks, safe object-key generation, R2 put/delete, and media registry lookup into `worker/lib/images.ts`. Parameterize ownership as `{ ownerType: "product" | "wholesale" | "site"; ownerId: string }` while keeping existing product image behavior and URLs compatible.

- [ ] **Step 5: Implement wholesale reads with the shared sold predicate**

Return only package metadata: representative images, audiences, condition scope, categories, piece count, stock, price, and lifecycle state. Use correlated aggregates or follow-up batch queries so many-to-many joins do not duplicate packages.

- [ ] **Step 6: Implement wholesale admin CRUD atomically**

Validate at least one audience and one clothing type, positive piece count and price, bounded stock, and compatible type assignments. Generate `JGC-W-*` references, unique slugs, publication timestamps, and sold timestamps using the same semantics as retail.

- [ ] **Step 7: Add public and admin routes**

Parse filters with Zod, return stable `400` errors for unknown audiences/types, and use existing auth/same-origin middleware for every mutation. Add image upload, delete, and reorder routes parallel to products.

- [ ] **Step 8: Serve all registered media safely**

Update `/media/*` registration lookup to recognize product, wholesale, and site object keys while preserving `nosniff`, immutable caching, MIME headers, and no direct bucket listing.

- [ ] **Step 9: Run focused tests plus product-image regression**

Run: `npm run test:worker -- tests/worker/wholesale.test.ts tests/worker/admin-wholesale.test.ts tests/worker/admin-images.test.ts tests/worker/integration-sold-lifecycle.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit wholesale backend support**

```bash
git add worker/db/wholesale.ts worker/lib/images.ts worker/db/products.ts worker/routes/public.ts worker/routes/admin.ts worker/index.ts tests/worker/wholesale.test.ts tests/worker/admin-wholesale.test.ts tests/worker/admin-images.test.ts
git commit -m "feat: add wholesale package APIs"
```

### Task 5: Build wholesale storefront and owner management

**Files:**
- Modify: `app/api.ts`
- Modify: `app/App.tsx`
- Create: `app/pages/WholesalePage.tsx`
- Create: `app/pages/WholesaleDetailPage.tsx`
- Create: `app/components/WholesaleCard.tsx`
- Modify: `app/admin/AdminLayout.tsx`
- Create: `app/admin/WholesalePage.tsx`
- Create: `app/admin/WholesaleForm.tsx`
- Create: `tests/pages/wholesale.test.tsx`
- Create: `tests/admin/wholesale.test.tsx`

**Interfaces:**
- Consumes: Task 4 wholesale APIs and Task 1 contracts.
- Produces: `/wholesale`, `/wholesale/:slug`, `/owner/wholesale`, `/owner/wholesale/new`, `/owner/wholesale/:id`, and `itemType: "wholesale"` cart-line creation.

- [ ] **Step 1: Write failing storefront tests**

Assert package cards show representative image, audience/condition scope, type names, `24 pieces`, package price, stock state, and no individual garment controls. Adding quantity two creates one selected wholesale line with quantity two.

- [ ] **Step 2: Write failing owner workflow tests**

Assert the owner can preserve entered package data after an image failure, edit audience/condition/type scopes, mark sold/restore/hide, and must type the exact package reference before permanent deletion.

- [ ] **Step 3: Run wholesale DOM tests and confirm missing components**

Run: `npm run test:dom -- tests/pages/wholesale.test.tsx tests/admin/wholesale.test.tsx`

Expected: FAIL because pages and API functions do not exist.

- [ ] **Step 4: Add typed API methods and routes**

Implement list/detail public requests and the full owner method set, including multipart image uploads. Register the four storefront/owner route groups in `App.tsx`.

- [ ] **Step 5: Build accessible wholesale browsing**

Use a real heading, search input, labeled filter controls for audience, condition, clothing type, piece-count range, price range, availability, and sort. Package cards link to details and express Sold with text.

- [ ] **Step 6: Build package cart entry**

Create lines with `itemType: "wholesale"`, `packageId`, reference, name, quantity, price, image, and selected state; do not include size or internal piece count in the cart identity.

- [ ] **Step 7: Build owner list/form flows**

Follow existing product form patterns, but use package scope controls, piece count, stock, price, publication/feature switches, description, and representative images. Keep unsaved fields in component state if one upload fails.

- [ ] **Step 8: Run wholesale UI tests and accessibility checks**

Run: `npm run test:dom -- tests/pages/wholesale.test.tsx tests/admin/wholesale.test.tsx tests/integration/accessibility.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit wholesale UI**

```bash
git add app/api.ts app/App.tsx app/pages/WholesalePage.tsx app/pages/WholesaleDetailPage.tsx app/components/WholesaleCard.tsx app/admin/AdminLayout.tsx app/admin/WholesalePage.tsx app/admin/WholesaleForm.tsx tests/pages/wholesale.test.tsx tests/admin/wholesale.test.tsx
git commit -m "feat: add wholesale shopping and management"
```

### Task 6: Add scheduled promotions and the deterministic discount engine

**Files:**
- Create: `worker/lib/promotions.ts`
- Create: `worker/db/promotions.ts`
- Modify: `worker/db/products.ts`
- Modify: `worker/db/wholesale.ts`
- Create: `tests/worker/promotion-calculator.test.ts`
- Create: `tests/worker/promotions.test.ts`
- Modify: `worker/routes/public.ts`
- Modify: `worker/routes/admin.ts`
- Modify: `app/api.ts`
- Modify: `app/App.tsx`
- Modify: `app/components/ProductCard.tsx`
- Modify: `app/components/WholesaleCard.tsx`
- Modify: `app/pages/ProductPage.tsx`
- Modify: `app/pages/WholesaleDetailPage.tsx`
- Modify: `app/admin/ProductsPage.tsx`
- Modify: `app/admin/WholesalePage.tsx`
- Create: `app/admin/PromotionsPage.tsx`
- Create: `app/admin/PromotionForm.tsx`
- Modify: `app/admin/AdminLayout.tsx`
- Create: `tests/admin/promotions.test.tsx`
- Modify: `tests/pages/storefront.test.tsx`
- Modify: `tests/pages/wholesale.test.tsx`

**Interfaces:**
- Consumes: Task 1 promotion tables/contracts/schema and retail/wholesale IDs.
- Produces: `calculatePromotion(lines, promotion)`, `getActivePromotion(db, now)`, promotion CRUD/eligibility APIs, `GET /api/promotion`, `promoEligible` on active eligible product/package payloads, and owner schedule management.

- [ ] **Step 1: Write table-driven complete-group calculator tests**

```ts
it.each([
  [5, 0], [6, 6], [7, 6], [11, 6], [12, 12], [18, 18],
])("discounts only complete groups for %i units", (quantity, discountedQuantity) => {
  const result = calculatePromotion(
    [{ key: "retail:a:M", unitPriceKobo: 10_000, quantity, eligible: true }],
    { requiredQuantity: 6, discountBasisPoints: 1500 },
  );
  expect(result.discountedQuantity).toBe(discountedQuantity);
});
```

Add a mixed-price case that proves the cheapest eligible units receive discounts, ineligible units never do, and per-unit basis-point discounts floor to whole kobo.

- [ ] **Step 2: Write schedule-boundary, pause, and overlap tests**

At `startAt - 1 ms` expect inactive, at `startAt` active, at `endAt - 1 ms` active, and at `endAt` inactive. Saving overlapping non-paused schedules returns `409 promotion_schedule_overlap`; paused schedules may overlap.

- [ ] **Step 3: Run promotion Worker tests and confirm missing modules**

Run: `npm run test:worker -- tests/worker/promotion-calculator.test.ts tests/worker/promotions.test.ts`

Expected: FAIL because promotion functions and routes do not exist.

- [ ] **Step 4: Implement the pure allocation function**

```ts
export interface PromotionInputLine {
  key: string;
  unitPriceKobo: number;
  quantity: number;
  eligible: boolean;
}

export interface PromotionCalculation {
  eligibleQuantity: number;
  discountedQuantity: number;
  discountKobo: number;
  lines: Array<{ key: string; discountedQuantity: number; discountKobo: number }>;
}

export function calculatePromotion(
  lines: PromotionInputLine[],
  rule: { requiredQuantity: number; discountBasisPoints: number },
): PromotionCalculation;
```

Sort eligible line indexes by `unitPriceKobo`, then stable `key`; allocate `floor(totalEligible / requiredQuantity) * requiredQuantity` units, compute `floor(unitPriceKobo * basisPoints / 10_000)` per discounted unit, and return per-line discounted quantities and discount kobo.

- [ ] **Step 5: Implement promotion persistence and overlap detection**

Normalize all stored times to UTC ISO strings. Detect overlap using `existing.start_at < candidate.end_at AND existing.end_at > candidate.start_at` for non-paused records excluding the edited ID. Eligibility replacement and the promotion row update must share one `db.batch`.

- [ ] **Step 6: Add public summary and authenticated CRUD routes**

Public output includes only the active customer-facing summary. Product and wholesale reads expose `promoEligible: true` only when their ID belongs to that currently active promotion; the flag disappears at pause/end without republishing the item. Admin output includes schedule, pause state, and eligible IDs. Every mutation uses existing owner authentication and same-origin checks.

- [ ] **Step 7: Write failing owner UI tests**

Verify Africa/Lagos local datetime values serialize to correct UTC, percentage `15` becomes `1500` basis points, a six-item preview reads `Every complete group of 6 eligible cart items receives 15% off`, searchable retail/package eligibility can be selected, and pausing keeps the schedule.

- [ ] **Step 8: Build promotion owner pages**

Use `datetime-local` inputs with explicit `Africa/Lagos (WAT)` help text and conversion helpers that never depend on the computer's local timezone. Show schedule conflict responses beside the time fields and preserve all selections after failure. Add promotion-eligibility filters to the owner Products and Wholesale lists.

- [ ] **Step 9: Show active promotion eligibility on public items**

Render a textual `Promo` badge on eligible retail/package cards and details. Add DOM tests proving the badge is visible for an active eligible item and absent for an expired, paused, or ineligible item.

- [ ] **Step 10: Run promotion suites and typecheck**

Run: `npm run test:worker -- tests/worker/promotion-calculator.test.ts tests/worker/promotions.test.ts && npm run test:dom -- tests/admin/promotions.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 11: Commit promotion management**

```bash
git add worker/lib/promotions.ts worker/db/promotions.ts worker/db/products.ts worker/db/wholesale.ts worker/routes/public.ts worker/routes/admin.ts app/api.ts app/App.tsx app/components/ProductCard.tsx app/components/WholesaleCard.tsx app/pages/ProductPage.tsx app/pages/WholesaleDetailPage.tsx app/admin/ProductsPage.tsx app/admin/WholesalePage.tsx app/admin/PromotionsPage.tsx app/admin/PromotionForm.tsx app/admin/AdminLayout.tsx tests/worker/promotion-calculator.test.ts tests/worker/promotions.test.ts tests/admin/promotions.test.tsx tests/pages/storefront.test.tsx tests/pages/wholesale.test.tsx
git commit -m "feat: add scheduled group promotions"
```

### Task 7: Migrate the guest cart and validate mixed promotional orders

**Files:**
- Modify: `app/cart/cart-store.ts`
- Modify: `app/cart/CartPage.tsx`
- Modify: `app/cart/whatsapp.ts`
- Modify: `worker/db/products.ts`
- Modify: `worker/db/wholesale.ts`
- Modify: `worker/routes/public.ts`
- Modify: `tests/cart/cart-store.test.ts`
- Modify: `tests/cart/cart-page.test.tsx`
- Modify: `tests/cart/whatsapp.test.ts`
- Modify: `tests/worker/admin-products.test.ts`
- Create: `tests/worker/cart-promotions.test.ts`

**Interfaces:**
- Consumes: Task 1 cart union, Task 4 package lookup, Task 6 active promotion/calculator.
- Produces: version-2 local cart storage, `POST /api/cart/validate` for retail and wholesale, promotion progress/totals, and WhatsApp output identical to server validation.

- [ ] **Step 1: Write legacy/future/corrupt storage tests**

Seed a version-1 line without `itemType`, assert it loads as `itemType: "retail"`, save the migrated cart and assert version 2. Seed version 99 and malformed version 2, assert empty arrays, then save a valid cart and assert it loads normally.

- [ ] **Step 2: Write mixed-cart server tests**

Use five eligible retail units plus one eligible wholesale package containing 50 internal pieces; assert exactly six eligible cart units and six discounted units. Add package quantity two and assert the eligible count rises by two, not by 100.

- [ ] **Step 3: Write reconciliation and WhatsApp tests**

Cover a promotion ending during checkout, sold/hidden/deleted/out-of-stock items, canonical price changes, package quantity reduction, and a line split between discounted/full-price quantities. Assert message totals exactly equal `regularSubtotalKobo`, `promotion.discountKobo`, and `finalSubtotalKobo` from validation.

- [ ] **Step 4: Run cart tests and confirm the version/shape failures**

Run: `npm run test:dom -- tests/cart/cart-store.test.ts tests/cart/cart-page.test.tsx tests/cart/whatsapp.test.ts && npm run test:worker -- tests/worker/cart-promotions.test.ts`

Expected: FAIL because only version 1 retail lines and a single subtotal are supported.

- [ ] **Step 5: Implement version-2 storage and one-time migration**

Use discriminant-specific guards. Keep identity as `retail:<productId>:<size>` or `wholesale:<packageId>`. Migrate only valid version-1 retail lines; future and malformed versions return empty without throwing.

- [ ] **Step 6: Implement authoritative mixed validation**

Validate selected lines only. Fetch retail and wholesale records server-side, reconcile availability/quantity/price, then call `getActivePromotion` and `calculatePromotion`. Return per-line `discountedQuantity` and `discountKobo`, regular subtotal, promotion breakdown, and final subtotal.

- [ ] **Step 7: Render mixed lines and promotion progress**

Retail lines show size; wholesale lines show `Wholesale package` and no size. Before qualification announce `4 of 6 eligible items selected—add 2 more to unlock 15% off.` After qualification show regular subtotal, promotion discount, and final selected subtotal in a polite live region.

- [ ] **Step 8: Build WhatsApp text solely from validated data**

Include each retail size or `Wholesale package`, canonical line totals, active promotion name, discounted quantity, percentage, discount, and final total. Never calculate a second discount in the browser.

- [ ] **Step 9: Run all cart suites and the shop-flow regression**

Run: `npm run test:dom -- tests/cart tests/integration/shop-flow.test.tsx && npm run test:worker -- tests/worker/cart-promotions.test.ts tests/worker/admin-products.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit the unified promotional cart**

```bash
git add app/cart/cart-store.ts app/cart/CartPage.tsx app/cart/whatsapp.ts worker/db/products.ts worker/db/wholesale.ts worker/routes/public.ts tests/cart tests/worker/cart-promotions.test.ts tests/worker/admin-products.test.ts
git commit -m "feat: validate mixed carts and promotion totals"
```

### Task 8: Add atomic owner-managed logo, hero, and copy settings

**Files:**
- Create: `worker/db/site-settings.ts`
- Modify: `worker/routes/public.ts`
- Modify: `worker/routes/admin.ts`
- Modify: `worker/lib/images.ts`
- Create: `tests/worker/site-settings.test.ts`
- Modify: `app/api.ts`
- Modify: `app/App.tsx`
- Create: `app/admin/SiteSettingsPage.tsx`
- Modify: `app/admin/AdminLayout.tsx`
- Create: `tests/admin/site-settings.test.tsx`
- Create: `public/brand/joygiver-logo.jpeg`
- Create: `public/brand/family-hero.png`

**Interfaces:**
- Consumes: Task 1 `site_settings`, Task 4 image primitives, existing R2 binding, supplied logo, and approved generated hero.
- Produces: `GET /api/settings`, authenticated text update and asset replacement routes, owner Site Settings page, and static fallbacks.

- [ ] **Step 1: Copy approved assets into project fallbacks**

Run these binary-safe copies; do not transform or overwrite the source files.

```powershell
Copy-Item -LiteralPath 'C:\Users\aydon\Downloads\WhatsApp Image 2026-09-21 at 15.36.38.jpeg' -Destination 'public\brand\joygiver-logo.jpeg'
Copy-Item -LiteralPath 'C:\Users\aydon\.codex\generated_images\01a0bb96-68b1-7843-9dfd-ddee01e691a3\exec-dd636bc0-e1f5-428d-941b-e506a1acacff.png' -Destination 'public\brand\family-hero.png'
```

- [ ] **Step 2: Write public/default and authenticated settings tests**

Assert defaults return fallback URLs and family copy, text updates require owner + same origin, only logo/hero slots are accepted, and wrong MIME/oversized uploads fail without changing settings.

- [ ] **Step 3: Write the review-focus atomic replacement test**

Inject a D1 update failure after a successful R2 put, assert the response is an error, the prior object key remains active, and the attempted replacement object no longer exists in R2. On success, assert the D1 key changes before the former object is deleted.

- [ ] **Step 4: Run the settings Worker test and confirm missing routes**

Run: `npm run test:worker -- tests/worker/site-settings.test.ts`

Expected: FAIL with `404` for settings routes.

- [ ] **Step 5: Implement singleton settings reads and swaps**

Return fallback paths when nullable object keys are absent. For replacement: validate → put new object → update D1 key → delete old object. If D1 update fails, delete the new object and leave the old key/object untouched.

- [ ] **Step 6: Add public and admin settings routes**

Public response contains logo URL, hero URL, heading, and supporting copy. Owner text updates use JSON; logo/hero replacements use one multipart file and return the complete current settings.

- [ ] **Step 7: Write and run failing owner page tests**

Assert previews use current URLs, successful upload refreshes the preview, failed upload keeps the previous preview, copy inputs retain text after server errors, and meaningful alt guidance is visible.

Run: `npm run test:dom -- tests/admin/site-settings.test.tsx`

Expected: FAIL because the page is absent.

- [ ] **Step 8: Build the Site Settings page and API client**

Provide separate logo and hero file inputs with JPEG/PNG/WebP and 8 MB help, current previews, and one copy form. Revoke object preview URLs on replacement/unmount and announce success/failure with live status text.

- [ ] **Step 9: Run settings tests and regression image tests**

Run: `npm run test:worker -- tests/worker/site-settings.test.ts tests/worker/admin-images.test.ts && npm run test:dom -- tests/admin/site-settings.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 10: Commit owner-managed branding**

```bash
git add worker/db/site-settings.ts worker/routes/public.ts worker/routes/admin.ts worker/lib/images.ts tests/worker/site-settings.test.ts app/api.ts app/App.tsx app/admin/SiteSettingsPage.tsx app/admin/AdminLayout.tsx tests/admin/site-settings.test.tsx public/brand/joygiver-logo.jpeg public/brand/family-hero.png
git commit -m "feat: add owner-managed brand settings"
```

### Task 9: Integrate the family home page, navigation, styling, and dashboard summary

**Files:**
- Modify: `shared/contracts.ts`
- Modify: `worker/db/products.ts`
- Modify: `worker/db/wholesale.ts`
- Modify: `worker/db/promotions.ts`
- Modify: `worker/routes/admin.ts`
- Modify: `app/pages/HomePage.tsx`
- Modify: `app/components/Layout.tsx`
- Modify: `app/components/MobileMenu.tsx`
- Modify: `app/config.ts`
- Modify: `app/admin/DashboardPage.tsx`
- Modify: `app/styles/globals.css`
- Modify: `app/styles/components.css`
- Modify: `tests/pages/storefront.test.tsx`
- Modify: `tests/pages/information-pages.test.tsx`
- Modify: `tests/integration/accessibility.test.tsx`
- Create: `tests/integration/responsive-navigation.test.tsx`
- Create: `tests/worker/dashboard-summary.test.ts`

**Interfaces:**
- Consumes: Tasks 2–8 public settings, products, promotion, wholesale, nav routes, and admin summary APIs.
- Produces: the approved complete storefront composition and owner overview.

- [ ] **Step 1: Write failing navigation, hero, and announcement tests**

Desktop must expose Home, New, Thrifted, Wholesale, About Us, Contact. The compact mobile collection nav contains Home/New/Thrifted; the right drawer contains Wholesale/About Us/Contact and WhatsApp/Facebook/Instagram/TikTok. The footer also contains WhatsApp/Facebook/Instagram/TikTok. The home page uses the settings logo/hero, contains no italic element, and announces an active promotion only when returned by the API.

- [ ] **Step 2: Write motion/accessibility tests**

Assert the mobile drawer traps focus and returns it, audience links keep normal anchor navigation, every state has text, and reduced-motion media rules disable page/drawer/filter/promotion transitions. Add a 320 px render assertion with no element wider than the document viewport.

- [ ] **Step 3: Run storefront/accessibility tests and confirm failures**

Run: `npm run test:dom -- tests/pages/storefront.test.tsx tests/pages/information-pages.test.tsx tests/integration/accessibility.test.tsx tests/integration/responsive-navigation.test.tsx`

Expected: FAIL on new navigation/settings/family content.

- [ ] **Step 4: Load home data without making the whole page fragile**

Fetch latest products, settings, active promotion, and a small wholesale feature independently with abort signals. Keep branded fallback assets/copy when settings fail; show retry only for catalogue content that cannot load.

- [ ] **Step 5: Implement approved home composition**

Use family-inclusive heading/supporting copy, logo separate from hero, clothing-only hero artwork, global search, eight latest retail arrivals, New/Thrifted links, optional active-promotion banner, wholesale introduction, cart explanation, and Abuja/nationwide delivery information.

- [ ] **Step 6: Implement approved navigation structure**

Desktop places Wholesale beside About Us and Contact. Mobile leaves Wholesale out of the compact condition bar and places it inside the right drawer above About Us/Contact/social links. Retain cart access and the single top-nav search control.

- [ ] **Step 7: Apply responsive visual rules**

Use squared editorial surfaces, no site italics, warm ivory/gold/blush/charcoal palette, wide desktop hero with left-safe text area, and full-bleed mobile background with a warm translucent overlay. Add direction-aware page transition classes for Home ↔ New ↔ Thrifted and disable them under `prefers-reduced-motion: reduce`.

- [ ] **Step 8: Expand owner overview**

Add a Worker test for `GET /api/admin/summary`, extend `InventorySummary`, and aggregate retail counts by Women/Men/Kids, available wholesale packages, and the current or next scheduled promotion. Render those fields in the overview and link quick actions to Products, Wholesale, Promotions, Clothing Types, and Site Settings.

- [ ] **Step 9: Run DOM, accessibility, type, and build checks**

Run: `npm run test:dom && npm run typecheck && npm run build`

Expected: PASS with no horizontal-overflow or accessibility regressions.

- [ ] **Step 10: Commit the integrated experience**

```bash
git add shared/contracts.ts worker/db/products.ts worker/db/wholesale.ts worker/db/promotions.ts worker/routes/admin.ts app/pages/HomePage.tsx app/components/Layout.tsx app/components/MobileMenu.tsx app/config.ts app/admin/DashboardPage.tsx app/styles/globals.css app/styles/components.css tests/pages tests/integration tests/worker/dashboard-summary.test.ts
git commit -m "feat: complete family storefront experience"
```

### Task 10: Verify migration, staging rollout, operations, and rollback safety

**Files:**
- Modify: `scripts/smoke-production.mjs`
- Modify: `README.md`
- Create: `tests/integration/family-commerce-flow.test.tsx`

**Interfaces:**
- Consumes: every earlier task and the existing Cloudflare staging resources.
- Produces: full regression evidence, documented deployment sequence, read-only staging smoke coverage, and an actionable rollback path.

- [ ] **Step 1: Write the full browser integration test**

Simulate: browse `/new/men`; add eligible retail; add a wholesale package; select only qualifying lines; receive canonical promotion totals; open WhatsApp; assert the URL contains only selected items and the exact validated final total. Include a legacy cart loaded before the route render.

- [ ] **Step 2: Run the integration test and fix only cross-feature wiring failures**

Run: `npm run test:dom -- tests/integration/family-commerce-flow.test.tsx`

Expected: PASS after wiring corrections; do not change approved pricing or navigation behavior to satisfy the test.

- [ ] **Step 3: Extend the read-only production smoke script**

Check `/api/health`, `/api/config`, `/api/settings`, `/api/categories?audience=women`, `/api/products?condition=new&audience=women&limit=1`, `/api/wholesale?limit=1`, and `/api/promotion`. Accept an empty catalogue/promotion but require valid response shapes and security headers.

- [ ] **Step 4: Document the exact release order**

README sequence:

1. Export remote D1 to a protected path.
2. Confirm `npx wrangler whoami` is the Joygiver account.
3. Apply `0002` remotely before deploying code.
4. Run the full local verification gate.
5. Deploy to the existing Workers staging URL.
6. Run read-only smoke checks.
7. Manually verify owner login, one retail audience edit, one package draft, one paused promotion, logo/hero previews, selective cart, and WhatsApp text.
8. Enter real catalogue data only after verification.

- [ ] **Step 5: Document rollback without destructive migration reversal**

State that Worker code can roll back to the previous deployment while additive tables/columns remain. Do not drop `0002` tables in production. Restore D1 from the pre-release export only if data corruption is confirmed, and preserve R2 objects referenced by either deployment until rollback verification completes.

- [ ] **Step 6: Run the complete local gate**

Run: `npm test && npm run typecheck && npm run build && npm audit`

Expected: all tests pass, TypeScript reports no errors, Vite builds successfully, and audit reports no known vulnerabilities.

- [ ] **Step 7: Apply the migration and deploy to staging**

Run, after confirming the active Cloudflare account and backup path:

```powershell
npm run db:migrate:remote
npm run deploy
```

Expected: migration `0002_family_catalogue_promotions_wholesale.sql` applies once and Wrangler reports the existing `joygiver-collections.joygivercollections.workers.dev` deployment URL.

- [ ] **Step 8: Run production smoke checks**

```powershell
$env:SMOKE_BASE_URL='https://joygiver-collections.joygivercollections.workers.dev'
npm run smoke
```

Expected: every read-only endpoint and security-header check passes.

- [ ] **Step 9: Commit operational documentation and final wiring**

```bash
git add scripts/smoke-production.mjs README.md tests/integration/family-commerce-flow.test.tsx
git commit -m "docs: add family commerce rollout checks"
```

- [ ] **Step 10: Review the branch before pushing**

Run: `git status --short && git log --oneline --decorate -12`

Expected: only the untracked local `.superpowers/` brainstorming directory may remain; feature commits are present and no secrets, `.dev.vars`, database exports, or source-path-only assets are staged.
