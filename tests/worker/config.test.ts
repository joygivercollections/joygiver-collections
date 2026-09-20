import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("exposes the public WhatsApp ordering number from the Worker binding", async () => {
  const response = await exports.default.fetch(new Request("https://joygivercollections.com/api/config"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ whatsAppNumber: "2348000000000" });
});
