import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app/App";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("redirects an unauthenticated dashboard visit to owner login", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 401, code: "authentication_required", message: "Owner login is required" }), { status: 401, headers: { "Content-Type": "application/json" } }));
  render(<MemoryRouter initialEntries={["/owner/products"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: /owner login/i })).toBeVisible();
});

it("shows a generic message for invalid credentials", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 401, code: "invalid_credentials", message: "Email or password is incorrect" }), { status: 401, headers: { "Content-Type": "application/json" } }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/owner/login"]}><App /></MemoryRouter>);
  await user.type(screen.getByLabelText(/email/i), "owner@example.com");
  await user.type(screen.getByLabelText(/password/i), "incorrect password");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText(/email or password is incorrect/i)).toBeVisible();
});
