export interface Admin {
  id: string;
  email: string;
}

export interface AdminWithPassword extends Admin {
  passwordHash: string;
}

interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
}

interface SessionRow {
  token_hash: string;
  admin_id: string;
  email: string;
  expires_at: string;
}

interface AttemptRow {
  attempt_count: number;
  window_started: string;
}

export async function countAdmins(db: D1Database): Promise<number> {
  return (
    (await db.prepare("SELECT COUNT(*) AS total FROM admins").first<number>("total")) ??
    0
  );
}

export async function createOwner(
  db: D1Database,
  email: string,
  passwordHash: string,
  now: Date,
): Promise<Admin> {
  const timestamp = now.toISOString();
  await db
    .prepare(
      `INSERT INTO admins (id, email, password_hash, password_changed_at, created_at)
       VALUES ('admin-owner', ?, ?, ?, ?)`,
    )
    .bind(email, passwordHash, timestamp, timestamp)
    .run();
  return { id: "admin-owner", email };
}

export async function findAdminByEmail(
  db: D1Database,
  email: string,
): Promise<AdminWithPassword | null> {
  const row = await db
    .prepare(
      `SELECT id, email, password_hash
       FROM admins
       WHERE email = ? COLLATE NOCASE
       LIMIT 1`,
    )
    .bind(email)
    .first<AdminRow>();
  return row
    ? { id: row.id, email: row.email, passwordHash: row.password_hash }
    : null;
}

export async function insertSession(
  db: D1Database,
  tokenHash: string,
  adminId: string,
  createdAt: Date,
  expiresAt: Date,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (token_hash, admin_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(tokenHash, adminId, createdAt.toISOString(), expiresAt.toISOString())
    .run();
}

export async function findSessionAdmin(
  db: D1Database,
  tokenHash: string,
  now: Date,
): Promise<Admin | null> {
  const row = await db
    .prepare(
      `SELECT s.token_hash, s.admin_id, a.email, s.expires_at
       FROM sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<SessionRow>();

  if (!row) return null;
  if (Date.parse(row.expires_at) <= now.getTime()) {
    await deleteSession(db, tokenHash);
    return null;
  }
  return { id: row.admin_id, email: row.email };
}

export async function deleteSession(
  db: D1Database,
  tokenHash: string,
): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function changePasswordAndKeepSession(
  db: D1Database,
  adminId: string,
  passwordHash: string,
  currentTokenHash: string,
  now: Date,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE admins
         SET password_hash = ?, password_changed_at = ?
         WHERE id = ?`,
      )
      .bind(passwordHash, now.toISOString(), adminId),
    db
      .prepare("DELETE FROM sessions WHERE admin_id = ? AND token_hash != ?")
      .bind(adminId, currentTokenHash),
  ]);
}

export async function getLoginAttempt(
  db: D1Database,
  attemptKey: string,
): Promise<AttemptRow | null> {
  return db
    .prepare(
      `SELECT attempt_count, window_started
       FROM login_attempts
       WHERE attempt_key = ?`,
    )
    .bind(attemptKey)
    .first<AttemptRow>();
}

export async function recordFailedLogin(
  db: D1Database,
  attemptKey: string,
  now: Date,
  windowCutoff: Date,
): Promise<void> {
  const timestamp = now.toISOString();
  await db
    .prepare(
      `INSERT INTO login_attempts (attempt_key, window_started, attempt_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(attempt_key) DO UPDATE SET
         attempt_count = CASE
           WHEN login_attempts.window_started <= ? THEN 1
           ELSE login_attempts.attempt_count + 1
         END,
         window_started = CASE
           WHEN login_attempts.window_started <= ? THEN excluded.window_started
           ELSE login_attempts.window_started
         END,
         updated_at = excluded.updated_at`,
    )
    .bind(
      attemptKey,
      timestamp,
      timestamp,
      windowCutoff.toISOString(),
      windowCutoff.toISOString(),
    )
    .run();
}

export async function clearLoginAttempts(
  db: D1Database,
  attemptKey: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM login_attempts WHERE attempt_key = ?")
    .bind(attemptKey)
    .run();
}
