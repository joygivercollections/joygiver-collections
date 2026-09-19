import { Hono } from "hono";

export interface Env {
  DB: D1Database;
  PRODUCT_IMAGES: R2Bucket;
  ASSETS: Fetcher;
  WHATSAPP_NUMBER: string;
  ADMIN_SETUP_TOKEN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (context) =>
  context.json({ ok: true, service: "joygiver-collections" }),
);

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

export default app;
