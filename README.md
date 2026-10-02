# Joygiver Collections

A mobile-first family fashion catalogue and owner dashboard for Joygiver Collections in Abuja. Customers can browse New and Thrifted clothing for Women, Men, and Kids, explore wholesale packages, use a guest cart, select only the cart lines they want, receive complete-group promotion discounts, and send one pre-filled WhatsApp order. The application runs as a React frontend and Cloudflare Worker backed by D1 and R2.

## What is included

- Mixed latest arrivals on the home page, with explicit **New** and **Thrifted** labels.
- Dedicated New and Thrifted catalogues for Women, Men, and Kids, with audience-specific clothing types and filters.
- Unisex labels without a separate public Unisex catalogue.
- Wholesale packages described by package image, clothing types, piece count, price, audience, and condition.
- Scheduled complete-group promotions that discount only full quantity multiples.
- Guest cart stored in the browser—no customer account required.
- Selective checkout: only checked cart items appear in the WhatsApp order.
- Server-side price, stock, size, and availability validation immediately before ordering.
- Owner email/password login with retail, wholesale, promotion, clothing-type, brand-asset, inventory-state, and password management.
- Sold items remain visibly sold for 48 hours, then disappear from the public catalogue while staying in the owner dashboard.
- D1 product data, R2 product images, same-origin mutation protection, secure sessions, and login throttling.

## Local development

Use Node.js 24 or newer.

```powershell
npm install --legacy-peer-deps
npm run db:migrate:local
npm run dev
```

For a local WhatsApp button, copy `.env.example` to `.env.local` and replace the example number with the store's real international-format number, using digits only. Local owner bootstrap also requires an `ADMIN_SETUP_TOKEN` in `.dev.vars`; never commit `.dev.vars`.

Quality checks:

```powershell
npm test
npm run typecheck
npm run build
npm audit
```

## Cloudflare production setup

These commands modify the selected Cloudflare account. Confirm the active account with `npx wrangler whoami` first.

1. Create the data resources:

   ```powershell
   npx wrangler d1 create joygiver-store
   npx wrangler r2 bucket create joygiver-product-images
   ```

2. Copy the D1 identifier returned by Cloudflare into `wrangler.jsonc`, replacing the all-zero placeholder. The R2 bucket is already bound as `PRODUCT_IMAGES` with the expected name.

3. Put the real WhatsApp business number in `vars.WHATSAPP_NUMBER` in `wrangler.jsonc`. Use international format with digits only and no leading `+`, spaces, or punctuation.

4. Generate a fresh, random 32-byte setup token and store it as a Worker secret. Do not write it into Git, `.env`, command history, screenshots, or this README.

   ```powershell
   npx wrangler secret put ADMIN_SETUP_TOKEN
   ```

5. Apply the D1 schema, run the full verification gate, and deploy:

   ```powershell
   npm run db:migrate:remote
   npm run deploy
   ```

6. The permanent staging URL is `https://joygiver-collections.joygivercollections.workers.dev`. The Wrangler route also declares `joygivercollections.com` as a custom domain; it can be added later, after the domain is active in the same Cloudflare account. Confirm the staging deployment before changing live DNS.

## One-time owner creation

After HTTPS deployment, call `POST /api/auth/bootstrap` once with the setup token in a Bearer authorization header and JSON containing the owner's real email and a strong password of at least 12 characters. Keep all three values out of source control. A successful request returns `201`; after an owner exists, the endpoint deliberately returns `404`.

Example request shape (placeholders only):

```text
POST https://joygivercollections.com/api/auth/bootstrap
Authorization: Bearer <SETUP_TOKEN>
Content-Type: application/json

{"email":"<OWNER_EMAIL>","password":"<OWNER_PASSWORD>"}
```

Immediately remove or rotate the setup secret after the owner is created:

```powershell
npx wrangler secret delete ADMIN_SETUP_TOKEN
```

The owner signs in at `/owner/login`.

## Owner operations

- **Add a product:** Dashboard → Products → Add product. Enter details, select New or Thrifted, choose category and sizes, upload up to six JPEG/PNG/WebP images (8 MB each), then publish.
- **Mark sold:** Products → Mark sold. The public card becomes non-orderable immediately and remains visible for 48 hours before automatic removal.
- **Correct a mistaken sale:** Products → Restore. The item returns to available status.
- **Hide without deleting:** Products → Hide. Hidden products disappear publicly but remain editable in the dashboard.
- **Delete permanently:** Products → Delete, then type the exact product reference. This permanently removes the record and R2 images.
- **Manage filters:** Categories lets the owner add, rename, reorder, or retire categories. A category with products cannot be retired until those products are reassigned.
- **Manage wholesale:** Wholesale lets the owner publish a package photo and its audience, condition, clothing types, piece count, stock, and package price without exposing every garment inside.
- **Schedule promotions:** Promotions lets the owner choose eligible retail items and wholesale packages, set the required complete-group quantity, percentage discount, and start/end time. A second discount group applies only at the next exact multiple.
- **Update the storefront:** Site Settings lets the owner replace the logo and family hero image and edit the hero heading/copy without a code deployment.
- **Change password:** Account → Change password. The current password is required, and all other sessions are revoked.

## Brand assets and social links

The storefront loads the logo, family hero image, and hero copy from owner-managed Site Settings. `public/brand/joygiver-logo.jpeg` and `public/brand/family-hero.png` are safe fallback assets when settings cannot load. The home collection-panel photos are `public/brand/new-edit.png` and `public/brand/thrifted-edit.png`.

Add the store's Facebook, Instagram, and TikTok profile URLs in `app/config.ts`. Until real URLs are added, those icons remain visible but inactive. WhatsApp uses `VITE_WHATSAPP_NUMBER`.

## Staging release order

Use this order for the family-commerce release. The database migration is additive, but the new Worker expects it to exist.

1. Export remote D1 to a protected path outside this repository:

   ```powershell
   npx wrangler d1 export joygiver-store --remote --output <PROTECTED_BACKUP_PATH>
   ```

2. Confirm `npx wrangler whoami` shows the Joygiver Cloudflare account.
3. Apply all pending migrations, including `0002_family_catalogue_promotions_wholesale.sql` and `0003_promotion_schedule_guards.sql`, remotely before deploying the new code:

   ```powershell
   npm run db:migrate:remote
   ```

4. Run the full local verification gate:

   ```powershell
   npm test
   npm run typecheck
   npm run build
   npm audit
   ```

5. Deploy to the existing Workers staging URL:

   ```powershell
   npx wrangler deploy
   ```

6. Run the read-only smoke checks:

   ```powershell
   $env:SMOKE_BASE_URL='https://joygiver-collections.joygivercollections.workers.dev'
   npm run smoke
   ```

7. Manually verify owner login, one retail audience edit, one wholesale package draft, one paused promotion, logo and hero previews, selective cart checkout, and the final WhatsApp text.
8. Enter the real catalogue only after every verification above passes.

## Production verification

Run the read-only smoke check after every deployment:

```powershell
$env:SMOKE_BASE_URL='https://joygiver-collections.joygivercollections.workers.dev'
npm run smoke
```

The smoke script is read-only. It validates health, configuration, settings, audience categories, retail, wholesale, promotion, guest protection, response shapes, and security headers without creating or changing store data.

## Backup, migration, and secret rotation

Export D1 before risky changes and store the resulting file in a protected backup location outside the repository:

```powershell
npx wrangler d1 export joygiver-store --remote --output <PROTECTED_BACKUP_PATH>
```

Schema updates belong in a new numbered file under `migrations/`; never edit a migration already applied in production. Apply new migrations with `npm run db:migrate:remote` before deploying code that depends on them.

R2 images should be covered by an account-level backup or object replication policy appropriate to the store. Periodically test restoring both database metadata and its referenced image objects.

Rotate a Worker secret by running `npx wrangler secret put <SECRET_NAME>` and supplying the replacement through the secure prompt. Changing the owner password from the dashboard revokes other owner sessions.

## Rollback safety

If the staging deployment fails, roll the Worker code back to the previous Cloudflare deployment while leaving the additive `0002` tables/columns and the `0003` promotion guards in place. Do not drop either schema migration in production: the earlier Worker can continue while these additive changes remain.

Restore D1 from the pre-release export only when data corruption is confirmed, not merely because code rollback is needed. Preserve every R2 object referenced by either the previous or current deployment until the rollback has been verified end to end, including owner login, catalogue reads, cart validation, and image delivery.
