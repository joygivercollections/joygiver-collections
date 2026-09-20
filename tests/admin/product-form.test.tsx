import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ProductForm } from "../../app/admin/ProductForm";

it("retains product fields and identifies an oversized image", async () => {
  const created = { id: "new-product", reference: "JGC-NEW", slug: "champagne-maxi-skirt", images: [] };
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    if (String(input).includes("/categories")) return new Response(JSON.stringify([{ id: "maxi", name: "Maxi Skirts", slug: "maxi-skirts", active: true, displayOrder: 1 }]), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify(created), { status: 201, headers: { "Content-Type": "application/json" } });
  }));
  const user = userEvent.setup();
  render(<MemoryRouter><ProductForm /></MemoryRouter>);
  await user.type(screen.getByLabelText(/product name/i), "Champagne Maxi Skirt");
  await user.type(screen.getByLabelText(/^description/i), "Elegant flowing maxi skirt");
  await user.type(screen.getByLabelText(/price in naira/i), "24000");
  await user.selectOptions(await screen.findByLabelText(/^category/i), "maxi");
  await user.click(screen.getByLabelText(/^medium/i));
  const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "oversized.jpg", { type: "image/jpeg" });
  await user.upload(screen.getByLabelText(/product images/i), oversized);
  await user.click(screen.getByRole("button", { name: /save product/i }));
  expect(screen.getByLabelText(/product name/i)).toHaveValue("Champagne Maxi Skirt");
  expect(await screen.findByText(/oversized.jpg could not be uploaded/i)).toBeVisible();
});
