# Joygiver Collections

A mobile-first catalogue and owner dashboard for Joygiver Collections in Abuja. Customers can browse New and Thrifted collections, filter the catalogue, use a guest cart, select only the cart lines they want, and send one pre-filled WhatsApp order. The application runs as a React frontend and Cloudflare Worker backed by D1 and R2.

## What is included

- Mixed latest arrivals on the home page, with explicit **New** and **Thrifted** labels.
- Dedicated New and Thrifted catalogues with search, category, size, price, and sort filters.
- Guest cart stored in the browser—no customer account required.
- Selective checkout: only checked cart items appear in the WhatsApp order.
- Server-side price, stock, size, and availability validation immediately before ordering.
- Owner email/password login with product, category, image, inventory-state, and password management.
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

6. The Wrangler route declares `joygivercollections.com` as a custom domain. The domain must be active in the same Cloudflare account. Configure the registrar to use the Cloudflare nameservers if it is not already on Cloudflare. Confirm the deployment in the Cloudflare dashboard before changing live DNS.

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
- **Change password:** Account → Change password. The current password is required, and all other sessions are revoked.

## Production verification

Run the read-only smoke check after every deployment:

```powershell
$env:SMOKE_BASE_URL='https://joygivercollections.com'
npm run smoke
```

Then manually test owner login, one image upload, publication, cart persistence after refresh, selecting one line from a two-line cart, WhatsApp message contents, and marking/restoring a test item.

## Backup, migration, and secret rotation

Export D1 before risky changes and store the resulting file in a protected backup location outside the repository:

```powershell
npx wrangler d1 export joygiver-store --remote --output <PROTECTED_BACKUP_PATH>
```

Schema updates belong in a new numbered file under `migrations/`; never edit a migration already applied in production. Apply new migrations with `npm run db:migrate:remote` before deploying code that depends on them.

R2 images should be covered by an account-level backup or object replication policy appropriate to the store. Periodically test restoring both database metadata and its referenced image objects.

Rotate a Worker secret by running `npx wrangler secret put <SECRET_NAME>` and supplying the replacement through the secure prompt. Changing the owner password from the dashboard revokes other owner sessions.
