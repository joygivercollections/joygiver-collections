import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app/App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    if (String(input).includes("/api/settings")) return new Response(JSON.stringify({ logoUrl: "/brand/joygiver-logo.jpeg", heroUrl: "/brand/family-hero.png", heroHeading: "Style for every story.", heroCopy: "Fashion for women, men, and kids." }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (String(input).includes("/api/config")) return new Response(JSON.stringify({ whatsAppNumber: "2348069010690" }), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error(`Unexpected request: ${String(input)}`);
  }));
});

it("renders the Joygiver story on the About Us route", () => {
  render(<MemoryRouter initialEntries={["/about"]}><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: /fashion with intention/i })).toBeVisible();
  expect(screen.getAllByText(/abuja/i).length).toBeGreaterThan(1);
});

it("renders nationwide delivery contact information", () => {
  render(<MemoryRouter initialEntries={["/contact"]}><App /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: /let's talk style/i })).toBeVisible();
  expect(screen.getAllByText(/nationwide delivery/i).length).toBeGreaterThan(1);
});
