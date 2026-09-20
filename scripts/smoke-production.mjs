const baseUrl = process.env.SMOKE_BASE_URL;

if (!baseUrl) {
  throw new Error("SMOKE_BASE_URL is required (for example, https://joygivercollections.com)");
}

const base = new URL(baseUrl);
const checks = [
  "/",
  "/new",
  "/thrifted",
  "/api/health",
  "/api/categories",
  "/api/products?limit=1",
];

for (const path of checks) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: path.startsWith("/api/") ? "application/json" : "text/html" },
  });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`${path} returned ${response.status}`);
  }
  console.log(`✓ ${path} (${response.status})`);
}

const protectedResponse = await fetch(new URL("/api/admin/summary", base), {
  signal: AbortSignal.timeout(15_000),
});
if (protectedResponse.status !== 401) {
  throw new Error(`protected route returned ${protectedResponse.status}, expected 401`);
}
console.log("✓ protected owner API rejects guests (401)");

const configResponse = await fetch(new URL("/api/config", base), {
  signal: AbortSignal.timeout(15_000),
});
const config = await configResponse.json();
if (!/^\d{10,15}$/.test(config.whatsAppNumber ?? "")) {
  throw new Error("WHATSAPP_NUMBER is missing or invalid in the production Worker configuration");
}
console.log("✓ WhatsApp ordering number is configured");

const healthResponse = await fetch(new URL("/api/health", base), {
  signal: AbortSignal.timeout(15_000),
});
if (healthResponse.headers.get("x-content-type-options") !== "nosniff") {
  throw new Error("expected browser security headers were not present");
}
console.log("✓ browser security headers are present");
console.log("Production smoke checks passed");
