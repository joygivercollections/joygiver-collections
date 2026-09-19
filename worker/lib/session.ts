import type { Admin } from "../db/auth";
import { deleteSession, findSessionAdmin, insertSession } from "../db/auth";
import { sha256Hex } from "./password";

export const SESSION_COOKIE = "__Host-jc_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function randomToken(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  for (const segment of cookie.split(";")) {
    const [rawName, ...rawValue] = segment.trim().split("=");
    if (rawName === SESSION_COOKIE) return rawValue.join("=") || null;
  }
  return null;
}

export async function hashSessionToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export async function createSession(
  db: D1Database,
  adminId: string,
  now = new Date(),
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const token = randomToken(32);
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1_000);
  await insertSession(db, tokenHash, adminId, now, expiresAt);
  return { token, tokenHash, expiresAt };
}

export async function getAdminFromRequest(
  db: D1Database,
  request: Request,
  now = new Date(),
): Promise<Admin | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  return findSessionAdmin(db, await hashSessionToken(token), now);
}

export async function requireAdmin(
  db: D1Database,
  request: Request,
  now = new Date(),
): Promise<Admin> {
  const admin = await getAdminFromRequest(db, request, now);
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}

export async function deleteRequestSession(
  db: D1Database,
  request: Request,
): Promise<void> {
  const token = readSessionToken(request);
  if (token) await deleteSession(db, await hashSessionToken(token));
}
