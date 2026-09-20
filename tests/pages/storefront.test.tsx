import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import type { ProductSummary } from "../../shared/contracts";

const products: ProductSummary[] = Array.from({ length: 8 }, (_, index) => ({
  id: `product-${index}`,
  reference: `JGC-${1000 + index}`,
  slug: `silk-look-${index}`,
  name: index % 2 === 0 ? `Silk-look gown ${index + 1}` : `Denim set ${index + 1}`,
  priceKobo: 18_500_00 + index * 100_00,
  condition: index % 2 === 0 ? "new" : "thrifted",
  category: {
    id: index % 2 === 0 ? "gowns" : "two-piece-sets",
    name: index % 2 === 0 ? "Gowns" : "Two-piece Sets",
    slug: index % 2 === 0 ? "gowns" : "two-piece-sets",
  },
  sizes: ["M", "L"],
  tags: ["elegant"],
  stockQuantity: 1,
  state: "available",
  soldAt: null,
  primaryImage: null,
  publishedAt: new Date(2026, 8, 18 - index).toISOString(),
}));

const fetchMock = vi.fn<typeof fetch>();

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderAt(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/config")) {
      return okJson({ whatsAppNumber: "+234 803 000 0000" });
    }
    if (url.includes("/categories")) {
      return okJson([
        { id: "mini-skirts", name: "Mini Skirts", slug: "mini-skirts" },
        { id: "gowns", name: "Gowns", slug: "gowns" },
      ]);
    }
    if (url.includes("/products")) {
      return okJson({ items: products, page: 1, pageSize: 24, total: products.length });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("Joygiver storefront", () => {
  it("shows eight mixed latest arrivals and explicit condition badges", async () => {
    renderAt("/");

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(8);
    expect(cards.every((card) => within(card).getByText(/^(New|Thrifted)$/))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("sort=latest"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("limit=8"),
      expect.anything(),
    );
  });

  it("keeps catalogue filters in the URL and sends them to the API", async () => {
    const user = userEvent.setup();
    renderAt("/thrifted");

    await user.click(await screen.findByRole("button", { name: /filter products/i }));
    await user.click(screen.getByRole("checkbox", { name: /mini skirts/i }));
    await user.click(screen.getByRole("button", { name: /apply filters/i }));

    await waitFor(() => expect(window.location.search).toContain("category=mini-skirts"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/condition=thrifted.*category=mini-skirts|category=mini-skirts.*condition=thrifted/),
      expect.anything(),
    );
  });

  it("renders a retry action when the catalogue request fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes("/products")) throw new Error("offline");
      return okJson([]);
    });

    renderAt("/new");

    expect(await screen.findByRole("button", { name: /try again/i })).toBeVisible();
  });

  it("offers labelled search and primary collection navigation", async () => {
    renderAt("/");

    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("searchbox", { name: /search the collection/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /^new$/i })).toHaveAttribute("href", "/new");
    expect(screen.getByRole("link", { name: /^thrifted$/i })).toHaveAttribute("href", "/thrifted");
    expect(screen.getByRole("link", { name: /^about us$/i })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /^contact$/i })).toHaveAttribute("href", "/contact");
    expect(await screen.findByText(/latest arrivals/i)).toBeVisible();
  });

  it("opens a focused mobile menu with informational links and social icons", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    const menu = screen.getByRole("dialog", { name: /menu/i });
    expect(within(menu).getByRole("link", { name: /about us/i })).toHaveAttribute("href", "/about");
    expect(within(menu).getByRole("link", { name: /^contact$/i })).toHaveAttribute("href", "/contact");
    expect(within(menu).getByLabelText(/instagram/i)).toBeVisible();
    expect(within(menu).queryByRole("link", { name: /^new$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close menu/i })).toHaveFocus();
  });

  it("uses file-based brand artwork and exposes social channels in the footer", async () => {
    renderAt("/");

    expect(screen.getByTestId("hero-brand-art")).toHaveAttribute("src", "/brand/hero-art.svg");
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByLabelText(/facebook/i)).toBeVisible();
    expect(within(footer).getByLabelText(/tiktok/i)).toBeVisible();
    await waitFor(() => expect(within(footer).getByLabelText(/whatsapp/i)).toHaveAttribute("href", "https://wa.me/2348030000000"));
  });

  it("uses local fashion imagery in the condition panels without numbered labels", async () => {
    renderAt("/");

    const panels = screen.getByRole("region", { name: /shop by condition/i });
    const newImage = within(panels).getByTestId("new-collection-image");
    const thriftedImage = within(panels).getByTestId("thrifted-collection-image");
    expect(newImage).toHaveAttribute("src", "/brand/new-edit.png");
    expect(thriftedImage).toHaveAttribute("src", "/brand/thrifted-edit.png");
    expect(newImage).toHaveAttribute("loading", "lazy");
    expect(thriftedImage).toHaveAttribute("loading", "lazy");
    expect(newImage).toHaveAttribute("decoding", "async");
    expect(thriftedImage).toHaveAttribute("decoding", "async");
    expect(within(panels).queryByText(/^0[12]$/)).not.toBeInTheDocument();
  });

  it("sets the mobile page transition direction from collection order", async () => {
    const user = userEvent.setup();
    renderAt("/");

    const collections = screen.getByRole("navigation", { name: /collections/i });
    await user.click(within(collections).getByRole("link", { name: /new arrivals/i }));
    expect(document.querySelector("main")).toHaveClass("page-transition--forward");

    await user.click(within(collections).getByRole("link", { name: /^home$/i }));
    expect(document.querySelector("main")).toHaveClass("page-transition--backward");
  });
});
