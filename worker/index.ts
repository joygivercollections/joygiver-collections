import { Hono } from "hono";
import { publicRoutes } from "./routes/public";

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

app.route("/api", publicRoutes);

app.all("*", (context) => {
  if (!context.env.ASSETS) return context.notFound();
  return context.env.ASSETS.fetch(context.req.raw);
});

export default app;
