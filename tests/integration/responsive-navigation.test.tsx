import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app/App";

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 320 });
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/api/settings")) return okJson({ logoUrl: "/brand/joygiver-logo.jpeg", heroUrl: "/brand/family-hero.png", heroHeading: "Style for every story.", heroCopy: "Fashion for women, men, and kids." });
    if (url.includes("/api/promotion")) return okJson(null);
    if (url.includes("/api/wholesale")) return okJson({ items: [], page: 1, pageSize: 3, total: 0 });
    if (url.includes("/api/products")) return okJson({ items: [], page: 1, pageSize: 8, total: 0 });
    if (url.includes("/api/config")) return okJson({ whatsAppNumber: "2348069010690" });
    throw new Error(`Unexpected request: ${url}`);
  }));
});

it("keeps normal collection links and traps then restores drawer focus", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  const compactNav = screen.getByRole("navigation", { name: /collections/i });
  expect(within(compactNav).getByRole("link", { name: /^home$/i })).toHaveAttribute("href", "/");
  expect(within(compactNav).getByRole("link", { name: /new arrivals/i })).toHaveAttribute("href", "/new");
  expect(within(compactNav).getByRole("link", { name: /thrifted finds/i })).toHaveAttribute("href", "/thrifted");

  const trigger = screen.getByRole("button", { name: /open menu/i });
  await user.click(trigger);
  const drawer = screen.getByRole("dialog", { name: /menu/i });
  const close = within(drawer).getByRole("button", { name: /close menu/i });
  close.focus();
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(drawer).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: /menu/i })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("fits a 320 pixel viewport without a rendered element exceeding it", async () => {
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  await screen.findByRole("heading", { name: /style for every story/i });
  const tooWide = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((element) => element.getBoundingClientRect().width > document.documentElement.clientWidth + 1);
  expect(tooWide).toEqual([]);
});
