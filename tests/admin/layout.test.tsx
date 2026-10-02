import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminLayout } from "../../app/admin/AdminLayout";

const settings = {
  logoUrl: "/images/site/joygiver-logo.png",
  heroUrl: "/images/site/family-hero.png",
  heroHeading: "Style for every story.",
  heroCopy: "New and thrifted fashion for women, men, and kids.",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/api/auth/session")) {
      return new Response(JSON.stringify({ id: "owner-1", email: "owner@joygivercollections.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/admin/settings")) {
      return new Response(JSON.stringify(settings), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/owner/products"]}>
      <Routes>
        <Route path="owner" element={<AdminLayout />}>
          <Route path="products" element={<main>Product inventory</main>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

it("uses the owner-managed logo in desktop and mobile dashboard branding", async () => {
  renderLayout();

  const logos = await screen.findAllByRole("img", { name: /joygiver collections/i });
  expect(logos).toHaveLength(2);
  expect(logos.every((logo) => logo.getAttribute("src") === settings.logoUrl)).toBe(true);
});

it("offers a clearly labelled route back to the shop on every dashboard layout", async () => {
  renderLayout();

  const shopLinks = await screen.findAllByRole("link", { name: /view shop/i });
  expect(shopLinks).toHaveLength(2);
  expect(shopLinks.every((link) => link.getAttribute("href") === "/")).toBe(true);
});
