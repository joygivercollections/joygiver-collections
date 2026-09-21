import type { AdminPromotion, PromotionSummary } from "../../shared/contracts";
import type { PromotionInput } from "../../shared/validation";

interface PromotionRow {
  id: string;
  name: string;
  description: string;
  required_quantity: number;
  discount_basis_points: number;
  start_at: string;
  end_at: string;
  paused: number;
  created_at: string;
  updated_at: string;
}

function summary(row: PromotionRow): PromotionSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    requiredQuantity: row.required_quantity,
    discountBasisPoints: row.discount_basis_points,
    startAt: row.start_at,
    endAt: row.end_at,
  };
}

async function mapAdmin(db: D1Database, row: PromotionRow): Promise<AdminPromotion> {
  const [products, packages] = await db.batch([
    db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id = ? ORDER BY product_id").bind(row.id),
    db.prepare("SELECT package_id FROM promotion_wholesale_packages WHERE promotion_id = ? ORDER BY package_id").bind(row.id),
  ]);
  return {
    ...summary(row),
    paused: row.paused === 1,
    productIds: (products as D1Result<{ product_id: string }>).results.map((item) => item.product_id),
    wholesalePackageIds: (packages as D1Result<{ package_id: string }>).results.map((item) => item.package_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getActivePromotion(db: D1Database, now = new Date()): Promise<AdminPromotion | null> {
  const timestamp = now.toISOString();
  const row = await db.prepare(
    `SELECT * FROM promotions
     WHERE paused = 0 AND start_at <= ? AND end_at > ?
     ORDER BY start_at DESC LIMIT 1`,
  ).bind(timestamp, timestamp).first<PromotionRow>();
  return row ? mapAdmin(db, row) : null;
}

export async function getPublicPromotion(db: D1Database, now = new Date()): Promise<PromotionSummary | null> {
  const active = await getActivePromotion(db, now);
  if (!active) return null;
  const { paused: _paused, productIds: _productIds, wholesalePackageIds: _wholesalePackageIds, createdAt: _createdAt, updatedAt: _updatedAt, ...publicSummary } = active;
  return publicSummary;
}

export async function listAdminPromotions(db: D1Database): Promise<AdminPromotion[]> {
  const rows = await db.prepare("SELECT * FROM promotions ORDER BY start_at DESC, created_at DESC").all<PromotionRow>();
  return Promise.all(rows.results.map((row) => mapAdmin(db, row)));
}

export async function getAdminPromotion(db: D1Database, id: string): Promise<AdminPromotion | null> {
  const row = await db.prepare("SELECT * FROM promotions WHERE id = ? LIMIT 1").bind(id).first<PromotionRow>();
  return row ? mapAdmin(db, row) : null;
}

export class PromotionScheduleOverlapError extends Error {
  constructor() { super("This schedule overlaps another active promotion"); this.name = "PromotionScheduleOverlapError"; }
}

async function ensureNoOverlap(db: D1Database, input: PromotionInput, excludeId?: string) {
  if (input.paused) return;
  const row = await db.prepare(
    `SELECT id FROM promotions
     WHERE paused = 0 AND start_at < ? AND end_at > ?
       AND (? IS NULL OR id != ?)
     LIMIT 1`,
  ).bind(input.endAt, input.startAt, excludeId ?? null, excludeId ?? null).first();
  if (row) throw new PromotionScheduleOverlapError();
}

function eligibilityStatements(db: D1Database, id: string, input: PromotionInput) {
  return [
    db.prepare("DELETE FROM promotion_products WHERE promotion_id = ?").bind(id),
    db.prepare("DELETE FROM promotion_wholesale_packages WHERE promotion_id = ?").bind(id),
    ...input.productIds.map((productId) => db.prepare("INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)").bind(id, productId)),
    ...input.wholesalePackageIds.map((packageId) => db.prepare("INSERT INTO promotion_wholesale_packages (promotion_id, package_id) VALUES (?, ?)").bind(id, packageId)),
  ];
}

export async function createAdminPromotion(db: D1Database, input: PromotionInput, now = new Date()): Promise<AdminPromotion> {
  await ensureNoOverlap(db, input);
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  await db.batch([
    db.prepare(`INSERT INTO promotions (id, name, description, required_quantity, discount_basis_points, start_at, end_at, paused, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, input.name, input.description, input.requiredQuantity, input.discountBasisPoints, new Date(input.startAt).toISOString(), new Date(input.endAt).toISOString(), input.paused ? 1 : 0, timestamp, timestamp),
    ...eligibilityStatements(db, id, input).slice(2),
  ]);
  const created = await getAdminPromotion(db, id);
  if (!created) throw new Error("Created promotion could not be read");
  return created;
}

export async function updateAdminPromotion(db: D1Database, id: string, input: PromotionInput, now = new Date()): Promise<AdminPromotion | null> {
  if (!await getAdminPromotion(db, id)) return null;
  await ensureNoOverlap(db, input, id);
  await db.batch([
    db.prepare(`UPDATE promotions SET name = ?, description = ?, required_quantity = ?, discount_basis_points = ?, start_at = ?, end_at = ?, paused = ?, updated_at = ? WHERE id = ?`)
      .bind(input.name, input.description, input.requiredQuantity, input.discountBasisPoints, new Date(input.startAt).toISOString(), new Date(input.endAt).toISOString(), input.paused ? 1 : 0, now.toISOString(), id),
    ...eligibilityStatements(db, id, input),
  ]);
  return getAdminPromotion(db, id);
}

export async function deleteAdminPromotion(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM promotions WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
