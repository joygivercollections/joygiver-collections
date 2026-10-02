import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminLayout } from "../../app/admin/AdminLayout";

const settings = {
  logoUrl: "/images/site/joygiver-logo.png",
  heroUrl: "/images/site/family-hero.png",
  heroHeading: "Style for every story.",
  heroCopy: "New and thrifted fashion for women, men, and kids.",
};
const defaultUserAgent = navigator.userAgent;

beforeEach(() => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: defaultUserAgent });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: vi.fn(async () => ({ scope: "https://joygivercollections.com/owner/" })) },
  });
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

it("configures install metadata only while the owner dashboard is active", async () => {
  const rendered = renderLayout();

  await screen.findByText("Product inventory");
  expect(document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')).toHaveAttribute("href", "/owner.webmanifest");
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/owner-sw.js", { scope: "/owner/" });

  rendered.unmount();
  expect(document.head.querySelector('link[rel="manifest"]')).not.toBeInTheDocument();
});

it("lets the owner accept the browser installation prompt", async () => {
  const user = userEvent.setup();
  const prompt = vi.fn(async () => undefined);
  renderLayout();

  const installEvent = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  });
  window.dispatchEvent(installEvent);

  await user.click(await screen.findByRole("button", { name: /install owner app/i }));
  expect(prompt).toHaveBeenCalledTimes(1);
});

it("shows Safari installation instructions on iPhone", async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  renderLayout();

  await user.click(await screen.findByText("Install owner app"));
  const instructions = await screen.findByText(/tap share, choose add to home screen/i);
  expect(instructions).toBeVisible();
});
