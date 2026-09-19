# Joygiver Collections Website Design

## Purpose

Joygiver Collections needs a polished, mobile-first fashion storefront for new and thrifted women’s clothing. The store is based in Abuja, FCT and delivers throughout Nigeria. Customers will browse without creating accounts, build a cart, select which cart items they are ready to buy, and send those selected items to the owner in one pre-filled WhatsApp message.

The first release should make the business look trustworthy and established while remaining simple for one owner to operate. The owner must be able to maintain products and categories without editing code.

## Brand and visual direction

- Brand name: Joygiver Collections
- Preferred domain: `joygivercollections.com`
- Style: minimal, elegant, and luxurious
- Palette: warm white, soft ivory, charcoal, muted champagne gold, and pale neutral borders
- Typography: an editorial serif for the brand and major headings, paired with a clean sans-serif for controls and product information
- Photography supplies most of the page colour; decorative effects remain restrained
- Motion is subtle: image fades, smooth filter transitions, and modest control feedback
- The experience is designed for phones first, then expanded into a spacious desktop layout

## Public storefront

### Global navigation

The public header contains the Joygiver Collections identity, catalogue search, links to New and Thrifted, and a cart indicator. A slim announcement area states that the store is based in Abuja and delivers nationwide.

### Home page

The home page contains:

1. A refined hero introducing the brand and its mix of new and carefully selected thrifted clothing.
2. A prominent search field with examples such as dresses, skirts, and tops.
3. A compact Latest Arrivals catalogue containing the most recently uploaded available products across both New and Thrifted conditions.
4. Separate visual links to Shop New and Shop Thrifted.
5. A short explanation of the cart and WhatsApp ordering process.
6. Delivery information, contact/Instagram information when configured, and the site footer.

The home catalogue is intentionally limited. Customers use search or the New and Thrifted pages to see the full available range.

### New and Thrifted pages

New and Thrifted each have a dedicated catalogue page. Both pages provide:

- Search within the catalogue
- A mobile-friendly filter panel
- Category, size, price-range, and availability filters
- Sorting by latest, price from low to high, or price from high to low
- A responsive product grid

The initial category set is:

- Mini Skirts
- Maxi Skirts
- Sleeveless Tops
- Crop Tops
- Two-piece Sets
- Jeans
- Gowns
- Jumpsuits

The owner can create additional categories later. Each product has one condition, New or Thrifted, and one primary category. Searchable descriptive tags can add detail such as casual wear, office wear, denim, fitted, or maxi.

### Product presentation

Each product card shows its primary image, name, price in Nigerian naira, size, condition badge, availability, and Add to Cart action. A product detail view adds the full image gallery, reference number, description, category, tags, and condition notes where relevant.

New and Thrifted are always visually explicit. Customers should never have to infer a product’s condition from its description.

## Guest cart and WhatsApp ordering

The cart requires no customer account. It is retained on the customer’s device so that items remain available when the customer leaves and returns.

Every cart row has a selection checkbox. Customers may select one, several, or all items, with Select All and Clear Selection controls. The displayed checkout subtotal and the Order Selected Items on WhatsApp action reflect only checked, currently available items. Unselected items remain in the cart after the WhatsApp action.

Before opening WhatsApp, the checkout view collects the customer’s name and delivery city or area. The generated message contains:

- The name and reference number of every selected product
- Selected size and quantity
- Each item’s price
- The selected-items subtotal
- The customer’s name and delivery location
- A note that the nationwide delivery fee will be confirmed by the owner

The configured business WhatsApp number is used to open a pre-filled conversation. Sending the message is an order request, not payment or a stock reservation. The owner confirms availability, delivery cost, and payment in WhatsApp.

Unique thrift pieces have a maximum quantity of one. Other products use their configured stock quantity.

## Product availability and sold lifecycle

An available product can be placed in the cart and included in a WhatsApp order request. When the owner marks a product as sold:

1. The system records the sale time.
2. The product remains on the public site for 48 hours with a prominent Sold badge.
3. Add to Cart and order actions are disabled immediately.
4. After 48 hours, the product is automatically excluded from public catalogue and search results.
5. The product remains visible in the owner dashboard until the owner explicitly deletes it.

If a product becomes sold after a customer has added it to their cart, the cart marks it unavailable, clears its selection, and excludes it from the WhatsApp message and subtotal.

## Owner dashboard

The dashboard is separate from the customer storefront and protected by an owner email and password.

### Dashboard capabilities

- Overview counts for all, available, sold, New, and Thrifted products
- Add products with multiple images, name, generated or custom reference number, price, size, condition, category, tags, description, stock quantity, and featured status
- Search and filter the owner’s full product list
- Edit product information and reorder or remove images
- Mark products sold, return them to available status when correcting a mistake, or hide them temporarily
- Delete products with an explicit confirmation step
- Create, rename, and retire catalogue categories
- Change the owner password while authenticated

Latest Arrivals is calculated from product publication time. The owner may separately feature selected products in promotional home-page positions.

Orders are not stored in the dashboard in the first release because the sales conversation and confirmation happen in WhatsApp.

## Authentication and security

The first release supports one pre-created owner account and has no public registration.

- The password is stored only as a slow, salted password hash.
- Authentication uses a secure, HTTP-only, same-site session cookie with expiry.
- All write operations verify the owner session on the server.
- Repeated failed logins are rate limited.
- Product image uploads validate file type and size and receive server-generated storage names.
- State-changing requests are protected against cross-site request forgery where the chosen framework does not already provide equivalent protection.
- The owner can change the password in the dashboard. Initial forgotten-password recovery is performed through a secure deployment-side reset; automated recovery email is outside the first release.

## Cloudflare architecture

The system uses Cloudflare for hosting, application logic, and storage:

- The responsive frontend provides public pages, the guest cart, and the owner dashboard.
- A Cloudflare Worker exposes the catalogue, authentication, and owner-management endpoints.
- Cloudflare D1 stores owner credentials, products, categories, product-image metadata, stock state, publication time, and sold time.
- Cloudflare R2 stores uploaded product photographs. Only authenticated owner operations may upload or delete images.
- The guest cart remains browser-local and contains product identifiers, selected variants, quantities, and selection state. Current product price and availability are revalidated against the server before generating the WhatsApp order.

### Core data model

- `admins`: owner email, password hash, password-change timestamp
- `sessions`: hashed session token, owner, creation time, expiry time
- `categories`: name, slug, active status, display order
- `products`: reference, name, slug, description, price in kobo, condition, category, sizes, tags, stock quantity, availability state, featured state, publication time, sold time, and timestamps
- `product_images`: product, R2 object key, alt text, display order, and timestamps

The public catalogue reads only published products. The 48-hour sold visibility rule is calculated from `sold_at`, avoiding a separate scheduled deletion job.

## Data and interaction flow

1. Public catalogue pages request current product data from the Worker.
2. The Worker queries D1 and returns only products allowed by publication and sold-visibility rules.
3. The browser stores guest cart choices locally but rechecks selected items with the Worker before checkout.
4. The site composes the WhatsApp message from the revalidated items and opens WhatsApp; it does not mark items sold automatically.
5. The owner logs in, and the Worker creates a secure session.
6. Owner product changes are validated by the Worker and persisted in D1.
7. Product photos are uploaded to R2, while their ordering and descriptive metadata are stored in D1.

## Responsive and accessible behaviour

- Mobile uses a compact header, highly visible search, a two-column product grid where space allows, large touch targets, a slide-up filter panel, and a persistent cart count.
- Desktop uses a wider product grid, generous white space, and restrained hover feedback.
- Filters, cart selection, login, and dashboard forms are fully keyboard operable.
- Product imagery has meaningful alternative text, controls have visible labels and focus states, and colour is never the only indicator of condition or sold status.
- Empty, loading, error, no-results, and offline states provide a clear next action.

## Error handling

- Failed catalogue requests show a retry action without discarding the local cart.
- Failed uploads leave the product form intact and identify the image that failed.
- Invalid or expired owner sessions return to login without exposing management data.
- Checkout revalidation explains which selected products changed price, became sold, or are no longer available before WhatsApp opens.
- Deleting a product also removes its associated R2 images through a protected server operation; partial failures are reported to the owner for retry.

## First-release exclusions

The first release does not include customer accounts, online card payment, delivery-fee calculation, automatic stock reservation, stored orders, ratings, wish lists, or automated email password recovery. These can be added later if the WhatsApp-led store outgrows the initial workflow.

## Verification criteria

- The storefront works at common phone, tablet, and desktop widths.
- Search, condition pages, filters, sorting, and product details return correct products.
- The guest cart persists, supports per-item selection, and generates a WhatsApp message containing only selected available items.
- Sold products disable purchasing immediately, remain publicly visible for 48 hours, then disappear from public results while remaining in the dashboard.
- Unauthenticated users cannot access owner data or perform product and image changes.
- The owner can create, edit, categorize, hide, sell, restore, and delete products and manage their images.
- D1 and R2 failures produce recoverable errors rather than lost forms or misleading success messages.
- A production build completes and the deployed domain serves the storefront securely.
