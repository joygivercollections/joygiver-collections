import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { CataloguePage } from "../../app/pages/CataloguePage";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    if (String(input).includes("categories")) return new Response(JSON.stringify([{ id: "gowns", name: "Gowns", slug: "gowns" }]), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ items: [], page: 1, pageSize: 24, total: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
});

it("moves focus into the filter dialog and returns it to the trigger on Escape", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/thrifted"]}><CataloguePage condition="thrifted" /></MemoryRouter>);
  const trigger = await screen.findByRole("button", { name: /filter products/i });
  await user.click(trigger);
  expect(screen.getByRole("button", { name: /close filters/i })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("keeps keyboard Tab focus within the open filter dialog", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/new"]}><CataloguePage condition="new" /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: /filter products/i }));
  const dialog = screen.getByRole("dialog");
  const close = screen.getByRole("button", { name: /close filters/i });
  close.focus();
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
});
