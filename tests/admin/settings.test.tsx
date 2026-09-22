import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AccountPage } from "../../app/admin/AccountPage";
import { CategoriesPage } from "../../app/admin/CategoriesPage";

it("requires matching new passwords before account update", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><AccountPage /></MemoryRouter>);
  await user.type(screen.getByLabelText(/^current password/i), "current-password");
  await user.type(screen.getByLabelText(/^new password/i), "a-new-password");
  await user.type(screen.getByLabelText(/confirm new password/i), "different-password");
  await user.click(screen.getByRole("button", { name: /update password/i }));
  expect(screen.getByText(/do not match/i)).toBeVisible();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows how many products block clothing type retirement", async () => {
  const category = { id: "gowns", name: "Gowns", slug: "gowns", active: true, displayOrder: 1, audiences: ["women"] };
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([category]), { status: 200, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 409, code: "category_in_use", message: "Reassign products", productCount: 3 }), { status: 409, headers: { "Content-Type": "application/json" } })));
  const user = userEvent.setup();
  render(<MemoryRouter><CategoriesPage /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: /retire/i }));
  expect(await screen.findByText(/3 retail products must be reassigned/i)).toBeVisible();
});

it("lets the owner assign a clothing type to multiple audiences", async () => {
  const category = { id: "jeans", name: "Jeans", slug: "jeans", active: true, displayOrder: 1, audiences: ["women", "men", "kids"] };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([category]), { status: 200, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...category, audiences: ["women", "men"] }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<MemoryRouter><CategoriesPage /></MemoryRouter>);
  const kids = await screen.findByRole("checkbox", { name: /kids.*jeans/i });
  await user.click(kids);
  await user.click(screen.getByRole("button", { name: /save jeans/i }));

  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/categories/jeans",
    expect.objectContaining({ body: expect.stringContaining('"audiences":["women","men"]') }),
  );
});
