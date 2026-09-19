import { deleteCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import { z } from "zod";
import { loginSchema } from "../../shared/validation";
import {
  changePasswordAndKeepSession,
  clearLoginAttempts,
  countAdmins,
  createOwner,
  findAdminByEmail,
  getLoginAttempt,
  recordFailedLogin,
} from "../db/auth";
import {
  constantTimeTextEqual,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "../lib/password";
import { requireSameOrigin } from "../lib/origin";
import {
  createSession,
  deleteRequestSession,
  getAdminFromRequest,
  hashSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../lib/session";

interface AuthBindings {
  DB: D1Database;
  ADMIN_SETUP_TOKEN: string;
}

const securePassword = z.string().min(12).max(128);
const bootstrapSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: securePassword,
});
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(1_024),
  newPassword: securePassword,
});

const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const MAX_LOGIN_FAILURES = 5;

export const authRoutes = new Hono<{ Bindings: AuthBindings }>();

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function mutationOriginIsAllowed(request: Request): boolean {
  return requireSameOrigin(request);
}

authRoutes.post("/bootstrap", async (context) => {
  if ((await countAdmins(context.env.DB)) > 0) return context.notFound();

  const authorization = context.req.header("Authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (
    !suppliedToken ||
    !constantTimeTextEqual(suppliedToken, context.env.ADMIN_SETUP_TOKEN)
  ) {
    return context.notFound();
  }

  const origin = context.req.header("Origin");
  if (origin && !mutationOriginIsAllowed(context.req.raw)) {
    return context.json(
      { status: 403, code: "origin_forbidden", message: "Request origin is not allowed" },
      403,
    );
  }

  const parsed = bootstrapSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      {
        status: 400,
        code: "invalid_owner",
        message: "Owner email or password is invalid",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const owner = await createOwner(
    context.env.DB,
    parsed.data.email,
    await hashPassword(parsed.data.password),
    new Date(),
  );
  return context.json(owner, 201);
});

authRoutes.post("/login", async (context) => {
  if (!mutationOriginIsAllowed(context.req.raw)) {
    return context.json(
      { status: 403, code: "origin_forbidden", message: "Request origin is not allowed" },
      403,
    );
  }

  const parsed = loginSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      { status: 401, code: "invalid_credentials", message: "Email or password is incorrect" },
      401,
    );
  }

  const now = new Date();
  const clientAddress = context.req.header("CF-Connecting-IP") ?? "unknown";
  const attemptKey = await sha256Hex(`${parsed.data.email}|${clientAddress}`);
  const attempt = await getLoginAttempt(context.env.DB, attemptKey);
  const windowCutoff = new Date(now.getTime() - LOGIN_WINDOW_MS);
  if (
    attempt &&
    Date.parse(attempt.window_started) > windowCutoff.getTime() &&
    attempt.attempt_count >= MAX_LOGIN_FAILURES
  ) {
    return context.json(
      { status: 429, code: "login_rate_limited", message: "Try again in a few minutes" },
      429,
    );
  }

  const admin = await findAdminByEmail(context.env.DB, parsed.data.email);
  let passwordMatches = false;
  if (admin) {
    passwordMatches = await verifyPassword(
      parsed.data.password,
      admin.passwordHash,
    );
  } else {
    // Keep the unknown-email path deliberately expensive to reduce account enumeration.
    await hashPassword(parsed.data.password);
  }

  if (!admin || !passwordMatches) {
    await recordFailedLogin(context.env.DB, attemptKey, now, windowCutoff);
    return context.json(
      { status: 401, code: "invalid_credentials", message: "Email or password is incorrect" },
      401,
    );
  }

  await clearLoginAttempts(context.env.DB, attemptKey);
  const session = await createSession(context.env.DB, admin.id, now);
  setCookie(context, SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return context.json({ id: admin.id, email: admin.email });
});

authRoutes.get("/session", async (context) => {
  const admin = await getAdminFromRequest(context.env.DB, context.req.raw);
  if (!admin) {
    return context.json(
      { status: 401, code: "authentication_required", message: "Owner login is required" },
      401,
    );
  }
  return context.json(admin);
});

authRoutes.post("/logout", async (context) => {
  if (!mutationOriginIsAllowed(context.req.raw)) {
    return context.json(
      { status: 403, code: "origin_forbidden", message: "Request origin is not allowed" },
      403,
    );
  }
  await deleteRequestSession(context.env.DB, context.req.raw);
  deleteCookie(context, SESSION_COOKIE, { path: "/", secure: true });
  return context.body(null, 204);
});

authRoutes.put("/password", async (context) => {
  if (!mutationOriginIsAllowed(context.req.raw)) {
    return context.json(
      { status: 403, code: "origin_forbidden", message: "Request origin is not allowed" },
      403,
    );
  }
  const admin = await getAdminFromRequest(context.env.DB, context.req.raw);
  const token = readSessionToken(context.req.raw);
  if (!admin || !token) {
    return context.json(
      { status: 401, code: "authentication_required", message: "Owner login is required" },
      401,
    );
  }

  const parsed = passwordChangeSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    return context.json(
      {
        status: 400,
        code: "invalid_password_change",
        message: "Password change details are invalid",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const current = await findAdminByEmail(context.env.DB, admin.email);
  if (!current || !(await verifyPassword(parsed.data.currentPassword, current.passwordHash))) {
    return context.json(
      { status: 400, code: "current_password_incorrect", message: "Current password is incorrect" },
      400,
    );
  }

  await changePasswordAndKeepSession(
    context.env.DB,
    admin.id,
    await hashPassword(parsed.data.newPassword),
    await hashSessionToken(token),
    new Date(),
  );
  return context.json({ ok: true });
});
