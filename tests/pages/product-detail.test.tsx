import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ProductPage } from "../../app/pages/ProductPage";
import type { Product } from "../../shared/contracts";

const product: Product = {
  id: "product-top",
  reference: "JGC-C6A05551",
  slug: "top",
  name: "Top",
  priceKobo: 5_000_00,
  condition: "new",
  category: { id: "crop-tops", name: "Crop Tops", slug: "crop-tops" },
  audiences: ["women"],
  isUnisex: false,
  promoEligible: false,
  sizes: ["M"],
  tags: [],
  stockQuantity: 1,
  state: "available",
  soldAt: null,
  primaryImage: { url: "/media/front.jpg", alt: "Black crop top front view" },
  publishedAt: "2026-09-22T08:00:00.000Z",
  description: "Black crop top",
  featured: false,
  images: [
    { id: "front", url: "/media/front.jpg", alt: "Black crop top front view", displayOrder: 0 },
    { id: "back", url: "/media/back.jpg", alt: "Black crop top back view", displayOrder: 1 },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(product), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })));
});

it("shows one active product image and changes it from the thumbnail rail", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/product/top"]}>
      <Routes><Route path="product/:slug" element={<ProductPage />} /></Routes>
    </MemoryRouter>,
  );

  const gallery = await screen.findByRole("region", { name: /product images/i });
  expect(within(gallery).getByRole("img", { name: /front view/i })).toHaveAttribute("src", "/media/front.jpg");
  expect(within(gallery).getByText("1 / 2")).toBeVisible();

  await user.click(within(gallery).getByRole("button", { name: /show image 2/i }));

  expect(within(gallery).getByRole("img", { name: /back view/i })).toHaveAttribute("src", "/media/back.jpg");
  expect(within(gallery).getByText("2 / 2")).toBeVisible();
});

it("cycles product images with previous and next controls", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/product/top"]}>
      <Routes><Route path="product/:slug" element={<ProductPage />} /></Routes>
    </MemoryRouter>,
  );

  const gallery = await screen.findByRole("region", { name: /product images/i });
  await user.click(within(gallery).getByRole("button", { name: /next image/i }));
  expect(within(gallery).getByRole("img", { name: /back view/i })).toBeVisible();

  await user.click(within(gallery).getByRole("button", { name: /previous image/i }));
  expect(within(gallery).getByRole("img", { name: /front view/i })).toBeVisible();
});
