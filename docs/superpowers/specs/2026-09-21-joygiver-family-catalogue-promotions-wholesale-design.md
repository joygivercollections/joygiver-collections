# Joygiver Collections Family Catalogue, Promotions, and Wholesale Design

## Purpose

Joygiver Collections will expand from a women-only fashion storefront into a family fashion store serving Women, Men, and Kids while preserving New and Thrifted as the two primary retail shopping paths. The redesign also introduces scheduled percentage promotions, wholesale packages, owner-managed logo and hero artwork, and a clothing-only editorial hero image.

The existing Cloudflare Worker, React storefront, D1 catalogue, R2 image storage, guest cart, WhatsApp checkout, owner authentication, and 48-hour sold lifecycle remain the foundation. This is an in-place extension rather than a rewrite.

## Approved language and navigation

- Public audience labels are `Women`, `Men`, and `Kids`.
- `Women` is preferred over `Ladies` or `Female` because it is the standard modern retail label.
- New and Thrifted remain the primary retail collection choices.
- Each New or Thrifted page provides audience tabs for Women, Men, and Kids.
- Unisex is a product badge and owner-managed placement property, not a standalone public collection or filter.
- Desktop primary navigation is Home, New, Thrifted, Wholesale, About Us, and Contact.
- Mobile collection navigation remains Home, New, and Thrifted.
- The right-side mobile hamburger contains Wholesale, About Us, Contact, and WhatsApp, Facebook, Instagram, and TikTok links.
- Wholesale is intentionally grouped with About Us and Contact rather than placed in the compact New/Thrifted mobile collection tabs.

Recommended shareable retail routes are:

- `/new/women`, `/new/men`, `/new/kids`
- `/thrifted/women`, `/thrifted/men`, `/thrifted/kids`
- `/wholesale`

`/new` and `/thrifted` default to Women while keeping the audience tabs visible. Search remains global and may be narrowed by condition, audience, clothing type, size, price, and availability.

## Retail product model

Retail products keep their current identity, reference, slug, condition, price, sizes, tags, stock, publication state, featured state, images, availability state, publication time, sold time, and timestamps.

Audience placement becomes a many-to-many relationship. A product may appear under any combination of Women, Men, and Kids. A separate `is_unisex` flag controls whether the visible Unisex badge is shown. The dashboard must require at least one audience placement. A Unisex product has no standalone route; it appears only in the audience sections selected by the owner.

Public product cards and product details show:

- New or Thrifted condition
- Women, Men, and/or Kids placement where useful
- Unisex badge when enabled
- Promo badge when eligible for the currently active promotion
- Sold badge and disabled ordering when sold

Existing Thrifted stock remains limited to one unit.

## Audience-aware clothing types

Clothing types replace the assumption that one flat category list applies equally to everyone. Each clothing type is stored once and assigned to one or more audiences. This avoids duplicate records such as Women's Jeans, Men's Jeans, and Kids' Jeans while still presenting different filter lists for each audience.

Initial assignments are:

### Women

- Mini Skirts
- Maxi Skirts
- Sleeveless Tops
- Crop Tops
- Two-piece Sets
- Jeans
- Gowns
- Jumpsuits

### Men

- Shirts
- T-shirts
- Polo Shirts
- Trousers
- Jeans
- Shorts
- Two-piece Sets
- Jackets

### Kids

- Dresses
- Tops
- T-shirts
- Two-piece Sets
- Trousers
- Jeans
- Shorts
- Skirts

The owner can create, rename, reorder, retire, and change the audience assignments of clothing types. A clothing type that is in use cannot be retired or removed from a required audience until affected products are reassigned.

## Wholesale packages

Wholesale packages are distinct catalogue records because customers do not browse or select the individual garments inside them. Each package contains:

- Name, generated or custom reference, and slug
- One or more representative images
- Short description
- Audience scope: Women, Men, Kids, or mixed
- Condition scope: New, Thrifted, or mixed
- Clothing types included
- Total number of clothing pieces inside the package
- Package price in kobo
- Package stock quantity
- Published and featured state
- Available, sold, or hidden state
- Publication, sold, creation, and update timestamps

Wholesale cards and details show the representative image, audience and condition scope, clothing types, piece count, package price, availability, and Add Package to Cart action. Individual internal garments are never exposed or selected.

Wholesale packages use the same guest cart and selective WhatsApp checkout as retail products. One package quantity counts as one cart unit, regardless of how many garments are inside. Packages use the same sold behavior as retail products: ordering stops immediately, the Sold badge remains public for 48 hours, and the package then disappears publicly while remaining in the owner dashboard.

## Scheduled percentage promotions

The owner may save several promotion records but only one promotion may be active at any instant. A promotion has:

- Name and optional customer-facing description
- Required group quantity, as a positive integer
- Percentage discount stored as integer basis points
- Start and end timestamps
- Paused state
- Eligible retail products
- Eligible wholesale packages
- Creation and update timestamps

The dashboard displays and accepts promotion times in Africa/Lagos time. D1 stores normalized UTC timestamps. End time must be later than start time. Saving a non-paused promotion whose schedule overlaps another non-paused promotion is rejected. The owner can pause a promotion early without deleting its schedule or eligibility list.

A promotion is active only when it is not paused and the current time is greater than or equal to its start time and strictly earlier than its end time.

### Discount calculation

The active promotion applies only to selected, currently available, eligible cart units. Each retail quantity unit counts once. Each wholesale package quantity counts once.

For a promotion requiring `N` items:

```text
discounted unit count = floor(total eligible selected units / N) × N
```

Only complete groups receive a discount. Examples for a six-item promotion are:

- 1–5 eligible units: no discount
- 6–11 eligible units: six discounted units
- 12–17 eligible units: twelve discounted units
- 18–23 eligible units: eighteen discounted units

Eligible units are ordered by canonical unit price from lowest to highest. The discount applies to the calculated number of lowest-priced eligible units. Incomplete extra units remain at regular price. This is deterministic and protects the store from unintentionally discounting the most expensive extras.

For each discounted unit:

```text
unit discount kobo = floor(unit price kobo × discount basis points / 10,000)
```

The server returns regular subtotal, promotion discount, and final subtotal. A cart line may contain both discounted and full-price quantities, so validated cart data must identify each count explicitly.

The cart shows progress before qualification, for example: `4 of 6 eligible items selected—add 2 more to unlock 15% off.` Once qualified, it shows regular subtotal, discount, and final subtotal. The WhatsApp message uses the same server-validated breakdown and states the active promotion name, discounted quantity, percentage, discount amount, and final selected-items subtotal.

Promotion badges and messages disappear automatically when the promotion ends or is paused. If a promotion or eligibility list changes while a customer is shopping, checkout revalidation explains the change and recalculates the order before enabling WhatsApp.

## Guest cart compatibility

Cart lines become a discriminated union with `itemType` equal to `retail` or `wholesale`. Retail lines keep required size and quantity information; wholesale lines omit size and refer to a package. Selection remains per line, and only selected lines are validated and included in WhatsApp.

Existing versioned carts without `itemType` migrate safely as retail lines. Unknown future cart versions still reset safely. The server remains authoritative for current price, stock, sold state, publication state, promotion eligibility, and promotion calculation.

## Storefront experience

The home page includes:

- The supplied Joygiver Collections logo
- A responsive clothing-only hero using the approved generated concept
- Hero copy reflecting New, Thrifted, Women, Men, Kids, and nationwide delivery
- Global search
- A limited latest-arrivals mix across conditions and audiences
- New and Thrifted collection links
- Active promotion announcement when applicable
- Wholesale introduction and link
- Cart and WhatsApp ordering explanation
- Abuja and nationwide-delivery information

New and Thrifted pages provide Women, Men, and Kids tabs. Filters show only clothing types assigned to the active audience. Product grids may include Unisex products assigned to that audience and label them clearly.

The Wholesale page provides search and filters for audience scope, condition scope, clothing type, piece-count range, price range, availability, and latest/price sorting.

## Logo, hero artwork, and site settings

The supplied logo source is `C:\Users\aydon\Downloads\WhatsApp Image 2026-09-21 at 15.36.38.jpeg`. The approved generated hero concept currently exists at `C:\Users\aydon\.codex\generated_images\01a0bb96-68b1-7843-9dfd-ddee01e691a3\exec-dd636bc0-e1f5-428d-941b-e506a1acacff.png`. Implementation must copy selected assets into the project or R2 and must not depend on these source paths at runtime.

The owner dashboard adds Site Settings with authenticated upload and replacement controls for:

- Primary logo
- Hero artwork
- Hero heading and short supporting copy

Site assets use the existing JPEG, PNG, and WebP validation rules and R2 storage. A replacement uploads successfully before the active setting changes. Failed uploads leave the current asset active. Replaced objects are cleaned up only after the new setting is committed.

The hero artwork contains clothing only: coordinated Women, Men, and Kids garments, no people, mannequins, body parts, text, logo, or watermark. Desktop uses the wide composition with headline-safe negative space. Mobile uses it as a full background with a warm translucent overlay, responsive positioning, and sufficient text contrast. The logo remains separate and replaceable.

## Owner dashboard

Owner navigation becomes:

- Overview
- Products
- Wholesale
- Promotions
- Clothing Types
- Site Settings
- Account

Retail product forms add audience checkboxes and a Unisex badge toggle. Inventory search and summary support condition, audience, clothing type, state, and promotion eligibility.

Wholesale management supports create, edit, publish, feature, hide, sell, restore, delete, image management, package contents summary, piece count, price, stock, audience scope, condition scope, and clothing types.

Promotion management supports draft/scheduled records, group quantity, percentage, Africa/Lagos start/end controls, pause/resume, and searchable multi-selection of eligible retail products and wholesale packages. The interface previews the customer-facing rule before save.

Clothing Type management adds Women, Men, and Kids assignment controls while preserving create, rename, reorder, retire, and in-use conflict handling.

Overview adds counts by audience, wholesale availability, and the current or next scheduled promotion.

## Storage and API changes

The D1 migration adds normalized relationships and new records without replacing current tables. Expected additions include:

- `product_audiences`
- `category_audiences`
- `wholesale_packages`
- `wholesale_package_categories`
- `wholesale_package_images`
- `promotions`
- `promotion_products`
- `promotion_wholesale_packages`
- `site_settings`

Public product queries accept an audience filter and include audience placements, Unisex state, and active promotion eligibility. New public endpoints expose wholesale listing/detail and the active promotion summary. Cart validation accepts retail and wholesale lines and returns the authoritative promotion breakdown.

Authenticated admin endpoints manage wholesale packages, promotions, clothing-type audience assignments, and site settings. All new mutations retain same-origin protection, authenticated sessions, input validation, and server-side authorization. R2 mutations remain private owner operations.

## Migration and rollout

The migration is additive and runs before the new Worker version is deployed.

- Existing products receive Women as their initial audience placement.
- Existing clothing types receive the approved audience assignments.
- Shared types such as Jeans and Two-piece Sets are assigned to all approved audiences rather than duplicated.
- Existing product, image, owner, session, and sold-lifecycle data remains unchanged.
- Existing browser carts migrate as retail lines.
- No initial promotion or wholesale package is created automatically.
- Current logo and hero fallbacks remain available until the new settings records are populated.

The redesigned version deploys first to the existing Workers staging URL. Database migration, API compatibility, public browsing, owner management, cart behavior, image upload, promotion calculation, and WhatsApp output must be verified before real catalogue entry begins.

## Error handling and edge cases

- No audience selected on a retail product: reject the owner form.
- Clothing type not assigned to every selected product audience: reject with a clear reassignment message.
- Overlapping non-paused promotion schedules: reject without changing the existing schedule.
- Promotion starts or ends during checkout: revalidate against server time and explain the resulting total change.
- Eligible product becomes sold, hidden, deleted, or out of stock: unselect and exclude it before promotion calculation.
- Eligible product price changes: use canonical price and explain the change before WhatsApp.
- Wholesale package quantity changes: reduce to available package stock and recalculate complete promotion groups.
- Site-asset upload or R2 failure: keep the previous logo or hero active.
- Partial wholesale image failure: retain the package form and identify the failed file.
- Unknown audience or clothing-type filters: return a stable `400` response without unsafe SQL.
- Sold items at exactly 48 hours: exclude consistently from public retail and wholesale results.

## Accessibility and responsive behavior

- Audience tabs, promotion links, filters, mobile drawer, cart controls, and dashboard forms are keyboard operable.
- Condition, audience, Unisex, Promo, and Sold states are expressed with text, not color alone.
- Promotion progress and recalculated totals use polite live announcements.
- Mobile touch targets remain at least 44 pixels where practical.
- Hero copy retains readable contrast at 320px through desktop widths.
- Reduced-motion preferences disable nonessential route, drawer, filter, and promotional transitions.
- Product and package images have owner-editable meaningful alternative text.

## Verification criteria

- New and Thrifted routes correctly isolate Women, Men, and Kids while including appropriately assigned Unisex products.
- Clothing-type filters show only types assigned to the current audience.
- Owner audience assignments and Unisex badges round-trip through create and edit flows.
- Wholesale packages display only representative package information and work in the shared selective cart.
- Wholesale sold items disable ordering immediately, remain public for 48 hours, then disappear publicly.
- Promotion boundaries are correct at the exact start and end timestamps.
- Paused promotions never apply.
- Overlapping active schedules are rejected.
- Group calculations are correct immediately below, at, and above multiples such as 5, 6, 7, 11, 12, and 18.
- Mixed-price discounts apply only to the required number of lowest-priced eligible units.
- Wholesale packages count as one unit per package quantity, not by internal piece count.
- Cart and WhatsApp show identical regular subtotal, discount, and final subtotal.
- Expired, paused, repriced, sold, hidden, deleted, and out-of-stock items are reconciled before WhatsApp.
- Owner-only wholesale, promotion, clothing-type, and site-setting mutations reject unauthenticated and cross-origin requests.
- Logo and hero replacement is atomic and recoverable after upload failure.
- Existing owner login, products, images, carts, sold lifecycle, and public routes remain compatible through migration.
- Mobile and desktop layouts remain accessible and free of horizontal overflow.

## Exclusions

This redesign does not add customer accounts, card payments, stored orders, delivery-fee calculation, automatic stock reservation, ratings, wish lists, multiple simultaneous active promotions, coupon codes, per-customer promotion limits, or visibility of individual garments inside wholesale packages.
