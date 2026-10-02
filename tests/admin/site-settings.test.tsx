import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SiteSettingsPage } from "../../app/admin/SiteSettingsPage";

const settings = { logoUrl: "/brand/joygiver-logo.jpeg", heroUrl: "/brand/family-hero.png", heroHeading: "Style for every story.", heroCopy: "Fashion for Women, Men, and Kids." };

it("updates an asset preview and keeps the previous preview after a failed replacement", async () => {
  const fetchMock = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/api/admin/settings")) return new Response(JSON.stringify(settings), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/settings/logo")) return new Response(JSON.stringify({ ...settings, logoUrl: "/media/site/logo/new.jpg" }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/settings/hero")) return new Response(JSON.stringify({ status: 503, code: "image_storage_unavailable", message: "Try again" }), { status: 503, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<SiteSettingsPage />);
  expect(await screen.findByAltText(/current joygiver logo/i)).toHaveAttribute("src", settings.logoUrl);
  await user.upload(screen.getByLabelText(/replace logo/i), new File([new Uint8Array([0xff, 0xd8, 0xff])], "logo.jpg", { type: "image/jpeg" }));
  expect(await screen.findByAltText(/current joygiver logo/i)).toHaveAttribute("src", "/media/site/logo/new.jpg");
  await user.upload(screen.getByLabelText(/replace hero/i), new File([new Uint8Array([0xff, 0xd8, 0xff])], "hero.jpg", { type: "image/jpeg" }));
  expect(await screen.findByText(/try again/i)).toBeVisible();
  expect(screen.getByAltText(/current hero/i)).toHaveAttribute("src", settings.heroUrl);
  expect(screen.getByText(/meaningful product context/i)).toBeVisible();
});

it("retains edited copy after a server error", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(settings), { status: 200, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 500, code: "failed", message: "Could not save" }), { status: 500, headers: { "Content-Type": "application/json" } })));
  const user = userEvent.setup();
  render(<SiteSettingsPage />);
  const heading = await screen.findByLabelText(/hero heading/i);
  await user.clear(heading); await user.type(heading, "Style for the whole family");
  await user.click(screen.getByRole("button", { name: /save homepage copy/i }));
  expect(await screen.findByText(/could not save/i)).toBeVisible();
  expect(heading).toHaveValue("Style for the whole family");
});
