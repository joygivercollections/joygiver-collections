import { env, exports } from "cloudflare:workers";
import { hashSessionToken, SESSION_COOKIE } from "../../worker/lib/session";

export const storeOrigin = "https://joygivercollections.com";
export const adminToken = "test-admin-session";

export const validProductInput = {
  name: "Ivory Two-piece Set",
  description: "A polished two-piece set for work and special occasions.",
  priceKobo: 2_850_000,
  condition: "new" as const,
  categoryId: "cat_two_piece_sets",
  sizes: ["M", "L"],
  tags: ["office wear", "occasion"],
  stockQuantity: 2,
  featured: true,
  published: true,
  audiences: ["women"] as const,
  isUnisex: false,
};

export async function resetStore() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM promotion_products"),
    env.DB.prepare("DELETE FROM promotion_wholesale_packages"),
    env.DB.prepare("DELETE FROM promotions"),
    env.DB.prepare("DELETE FROM wholesale_package_images"),
    env.DB.prepare("DELETE FROM wholesale_package_categories"),
    env.DB.prepare("DELETE FROM wholesale_package_audiences"),
    env.DB.prepare("DELETE FROM wholesale_packages"),
    env.DB.prepare("DELETE FROM product_images"),
    env.DB.prepare("DELETE FROM product_audiences"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM login_attempts"),
    env.DB.prepare("DELETE FROM admins"),
  ]);
}

export async function seedAdminSession() {
  await env.DB.prepare(
    `INSERT INTO admins (id, email, password_hash, password_changed_at, created_at)
     VALUES ('admin-owner', 'owner@joygivercollections.com', 'test-hash', ?, ?)`,
  )
    .bind("2026-09-20T00:00:00.000Z", "2026-09-20T00:00:00.000Z")
    .run();
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, admin_id, created_at, expires_at)
     VALUES (?, 'admin-owner', ?, ?)`,
  )
    .bind(
      await hashSessionToken(adminToken),
      "2026-09-20T00:00:00.000Z",
      "2099-09-27T00:00:00.000Z",
    )
    .run();
}

export function apiRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return exports.default.fetch(
    new Request(`${storeOrigin}${path}`, { ...init, headers }),
  );
}

export function adminRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE}=${adminToken}`);
  if (!["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase())) {
    headers.set("Origin", storeOrigin);
  }
  return apiRequest(path, { ...init, headers });
}

export async function createProduct(
  overrides: Partial<typeof validProductInput> = {},
) {
  const response = await adminRequest("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({ ...validProductInput, ...overrides }),
  });
  if (response.status !== 201) {
    throw new Error(`Product creation returned ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<{
    id: string;
    reference: string;
    slug: string;
    name: string;
    priceKobo: number;
    state: "available" | "sold" | "hidden";
    soldAt: string | null;
    publishedAt: string;
  }>;
}
