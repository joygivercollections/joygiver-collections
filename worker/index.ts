import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import { findRegisteredImage } from "./db/products";

export interface Env {
  DB: D1Database;
  PRODUCT_IMAGES: R2Bucket;
  ASSETS: Fetcher;
  WHATSAPP_NUMBER: string;
  ADMIN_SETUP_TOKEN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (context, next) => {
  await next();
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header("Referrer-Policy", "strict-origin-when-cross-origin");
  context.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  context.header("Cross-Origin-Opener-Policy", "same-origin");
  context.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  if (new URL(context.req.url).pathname.startsWith("/api/")) {
    context.header("Cache-Control", "no-store");
  }
});

app.get("/api/health", (context) =>
  context.json({ ok: true, service: "joygiver-collections" }),
);

app.route("/api", publicRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/admin", adminRoutes);

app.get("/media/*", async (context) => {
  const pathname = new URL(context.req.url).pathname;
  const encodedKey = pathname.slice("/media/".length);
  let key: string;
  try {
    key = encodedKey
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return context.notFound();
  }
  const metadata = await findRegisteredImage(context.env.DB, key);
  if (!metadata) return context.notFound();
  const object = await context.env.PRODUCT_IMAGES.get(metadata.objectKey);
  if (!object) return context.notFound();
  return new Response(object.body, {
    headers: {
      "Content-Type": metadata.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
});

app.all("*", (context) => {
  if (!context.env.ASSETS) return context.notFound();
  return context.env.ASSETS.fetch(context.req.raw);
});

export default app;
