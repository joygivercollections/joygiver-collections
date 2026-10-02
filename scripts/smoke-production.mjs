const baseUrl = process.env.SMOKE_BASE_URL;

if (!baseUrl) {
  throw new Error("SMOKE_BASE_URL is required (for example, https://joygiver-collections.joygivercollections.workers.dev)");
}

const base = new URL(baseUrl);

function requireSecurityHeaders(path, response) {
  const required = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-opener-policy": "same-origin",
    "cache-control": "no-store",
  };
  for (const [name, expected] of Object.entries(required)) {
    if (response.headers.get(name) !== expected) throw new Error(`${path} is missing ${name}: ${expected}`);
  }
  if (!response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
    throw new Error(`${path} is missing the expected Content-Security-Policy`);
  }
}

async function getJson(path, validate) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  requireSecurityHeaders(path, response);
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(`${path} did not return JSON`);
  const body = await response.json();
  if (!validate(body)) throw new Error(`${path} returned an unexpected response shape`);
  console.log(`✓ ${path} (${response.status})`);
  return body;
}

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isString = (value) => typeof value === "string";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isPaginated = (value) => isRecord(value) && Array.isArray(value.items) && isNumber(value.page) && isNumber(value.pageSize) && isNumber(value.total);

await getJson("/api/health", (body) => isRecord(body) && body.ok === true && body.service === "joygiver-collections");
const config = await getJson("/api/config", (body) => isRecord(body) && /^\d{10,15}$/.test(body.whatsAppNumber ?? ""));
if (!/^\d{10,15}$/.test(config.whatsAppNumber)) throw new Error("WHATSAPP_NUMBER is missing or invalid in the production Worker configuration");
await getJson("/api/settings", (body) => isRecord(body) && [body.logoUrl, body.heroUrl, body.heroHeading, body.heroCopy].every(isString));
await getJson("/api/categories?audience=women", (body) => Array.isArray(body) && body.every((item) => isRecord(item) && isString(item.id) && isString(item.name) && isString(item.slug)));
await getJson("/api/products?condition=new&audience=women&limit=1", (body) => isPaginated(body));
await getJson("/api/wholesale?limit=1", (body) => isPaginated(body));
await getJson("/api/promotion", (body) => body === null || (isRecord(body) && isString(body.id) && isString(body.name) && isNumber(body.requiredQuantity) && isNumber(body.discountBasisPoints) && isString(body.startAt) && isString(body.endAt)));

const protectedPath = "/api/admin/summary";
const protectedResponse = await fetch(new URL(protectedPath, base), { signal: AbortSignal.timeout(15_000) });
if (protectedResponse.status !== 401) throw new Error(`protected route returned ${protectedResponse.status}, expected 401`);
requireSecurityHeaders(protectedPath, protectedResponse);
console.log("✓ protected owner API rejects guests (401)");
console.log("Read-only production smoke checks passed");
