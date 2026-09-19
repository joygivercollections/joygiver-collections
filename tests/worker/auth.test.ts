import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../worker/lib/password";
import { hashSessionToken } from "../../worker/lib/session";

const origin = "https://joygivercollections.com";
const ownerEmail = "owner@joygivercollections.com";
const ownerPassword = "Owner passphrase 2026!";

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return exports.default.fetch(new Request(`${origin}${path}`, { ...init, headers }));
}

function jsonRequest(
  path: string,
  method: string,
  body: unknown,
  headers: HeadersInit = {},
) {
  return request(path, {
    method,
    headers: { Origin: origin, ...headers },
    body: JSON.stringify(body),
  });
}

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("Set-Cookie");
  if (!cookie) throw new Error("Expected a session cookie");
  return cookie.split(";", 1)[0];
}

async function seedOwner() {
  const passwordHash = await hashPassword(ownerPassword);
  await env.DB.prepare(
    `INSERT INTO admins (id, email, password_hash, password_changed_at, created_at)
     VALUES ('admin-owner', ?, ?, ?, ?)`,
  )
    .bind(
      ownerEmail,
      passwordHash,
      "2026-09-20T00:00:00.000Z",
      "2026-09-20T00:00:00.000Z",
    )
    .run();
  return passwordHash;
}

async function login(password = ownerPassword) {
  return jsonRequest("/api/auth/login", "POST", {
    email: ownerEmail,
    password,
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM login_attempts"),
    env.DB.prepare("DELETE FROM admins"),
  ]);
});

describe("password hashing", () => {
  it("verifies the correct password and rejects a different password", async () => {
    const stored = await hashPassword(ownerPassword);

    expect(await verifyPassword(ownerPassword, stored)).toBe(true);
    expect(await verifyPassword("wrong password", stored)).toBe(false);
    expect(stored).toMatch(/^pbkdf2-sha256\$310000\$/);
    expect(stored).not.toContain(ownerPassword);
  });
});

describe("owner bootstrap and login", () => {
  it("bootstraps exactly one owner with the setup token", async () => {
    const first = await request("/api/auth/bootstrap", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-setup-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    });
    const second = await request("/api/auth/bootstrap", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-setup-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "second@example.com", password: ownerPassword }),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(404);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS total FROM admins").first<number>(
        "total",
      ),
    ).toBe(1);
  });

  it("returns a secure cookie and current owner for valid credentials", async () => {
    await seedOwner();
    const response = await login();
    const setCookie = response.headers.get("Set-Cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain("__Host-jc_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");

    const session = await request("/api/auth/session", {
      headers: { Cookie: cookieFrom(response) },
    });
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({ email: ownerEmail });
  });

  it("rate limits the sixth failed login inside fifteen minutes", async () => {
    await seedOwner();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await login("incorrect passphrase")).status).toBe(401);
    }

    expect((await login("incorrect passphrase")).status).toBe(429);
  });
});

describe("protected mutations", () => {
  it("rejects forged and expired sessions", async () => {
    await seedOwner();
    const forged = await jsonRequest(
      "/api/auth/password",
      "PUT",
      { currentPassword: ownerPassword, newPassword: "New secure passphrase 2026!" },
      { Cookie: "__Host-jc_session=forged" },
    );

    const expiredToken = "expired-session-token";
    await env.DB.prepare(
      `INSERT INTO sessions (token_hash, admin_id, created_at, expires_at)
       VALUES (?, 'admin-owner', '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z')`,
    )
      .bind(await hashSessionToken(expiredToken))
      .run();
    const expired = await jsonRequest(
      "/api/auth/password",
      "PUT",
      { currentPassword: ownerPassword, newPassword: "New secure passphrase 2026!" },
      { Cookie: `__Host-jc_session=${expiredToken}` },
    );

    expect(forged.status).toBe(401);
    expect(expired.status).toBe(401);
  });

  it("rejects a cross-origin password change", async () => {
    await seedOwner();
    const loginResponse = await login();
    const response = await request("/api/auth/password", {
      method: "PUT",
      headers: {
        Origin: "https://attacker.example",
        Cookie: cookieFrom(loginResponse),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: ownerPassword,
        newPassword: "New secure passphrase 2026!",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("changes the password and invalidates every other session", async () => {
    await seedOwner();
    const firstLogin = await login();
    const secondLogin = await login();
    const firstCookie = cookieFrom(firstLogin);
    const secondCookie = cookieFrom(secondLogin);

    const changed = await jsonRequest(
      "/api/auth/password",
      "PUT",
      {
        currentPassword: ownerPassword,
        newPassword: "New secure passphrase 2026!",
      },
      { Cookie: firstCookie },
    );

    expect(changed.status).toBe(200);
    expect(
      (await request("/api/auth/session", { headers: { Cookie: firstCookie } })).status,
    ).toBe(200);
    expect(
      (await request("/api/auth/session", { headers: { Cookie: secondCookie } })).status,
    ).toBe(401);
    expect((await login(ownerPassword)).status).toBe(401);
    expect((await login("New secure passphrase 2026!")).status).toBe(200);
  });
});
