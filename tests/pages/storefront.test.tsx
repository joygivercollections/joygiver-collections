import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import type { ProductSummary } from "../../shared/contracts";

const settings = {
  logoUrl: "/images/site/logo.png",
  heroUrl: "/images/site/family-hero.png",
  heroHeading: "Style for every story.",
  heroCopy: "New and thrifted fashion for women, men, and kids.",
};

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
  audiences: ["women"],
  isUnisex: false,
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
    if (url.includes("/api/settings")) return okJson(settings);
    if (url.includes("/api/promotion")) return okJson(null);
    if (url.includes("/api/wholesale")) {
      return okJson({ items: [], page: 1, pageSize: 3, total: 0 });
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

    const latest = await screen.findByRole("region", { name: /latest arrivals/i });
    const cards = await within(latest).findAllByRole("article");
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

  it("keeps condition first and switches audience with shareable links", async () => {
    renderAt("/new/men");

    expect(await screen.findByRole("heading", { name: /new for men/i })).toBeVisible();
    expect(screen.getByRole("link", { name: "Women" })).toHaveAttribute("href", "/new/women");
    expect(screen.getByRole("link", { name: "Men" })).toHaveAttribute("href", "/new/men");
    expect(screen.getByRole("link", { name: "Kids" })).toHaveAttribute("href", "/new/kids");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/categories?audience=men"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/condition=new.*audience=men|audience=men.*condition=new/),
      expect.anything(),
    );
  });

  it("labels an assigned Unisex product without creating a Unisex collection", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/categories")) return okJson([]);
      if (url.includes("/products")) {
        return okJson({
          items: [{ ...products[0], audiences: ["women", "men"], isUnisex: true, promoEligible: true }],
          page: 1,
          pageSize: 24,
          total: 1,
        });
      }
      if (url.includes("/api/config")) return okJson({ whatsAppNumber: "2348030000000" });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAt("/new/women");

    expect(await screen.findByText("Unisex")).toBeVisible();
    expect(screen.getByText("Promo")).toBeVisible();
    expect(screen.queryByRole("link", { name: /^unisex$/i })).not.toBeInTheDocument();
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
    const primary = screen.getByRole("navigation", { name: /primary navigation/i });
    for (const [name, href] of [["Home", "/"], ["New", "/new"], ["Thrifted", "/thrifted"], ["Wholesale", "/wholesale"], ["About Us", "/about"], ["Contact", "/contact"]]) {
      expect(within(primary).getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(await screen.findByText(/latest arrivals/i)).toBeVisible();
  });

  it("opens a focused mobile menu with informational links and social icons", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    const menu = screen.getByRole("dialog", { name: /menu/i });
    expect(within(menu).getByRole("link", { name: /wholesale/i })).toHaveAttribute("href", "/wholesale");
    expect(within(menu).getByRole("link", { name: /about us/i })).toHaveAttribute("href", "/about");
    expect(within(menu).getByRole("link", { name: /^contact$/i })).toHaveAttribute("href", "/contact");
    for (const channel of ["WhatsApp", "Facebook", "Instagram", "TikTok"]) {
      expect(within(menu).getByLabelText(channel)).toBeVisible();
    }
    expect(within(menu).queryByRole("link", { name: /^new$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close menu/i })).toHaveFocus();
  });

  it("uses owner-managed branding without italic content and exposes social channels in the footer", async () => {
    renderAt("/");

    expect(await screen.findByTestId("site-logo")).toHaveAttribute("src", settings.logoUrl);
    expect(screen.getByTestId("hero-brand-art")).toHaveAttribute("src", settings.heroUrl);
    expect(screen.getByRole("heading", { name: settings.heroHeading })).toBeVisible();
    expect(document.querySelector("em, i")).not.toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    for (const channel of ["Facebook", "Instagram", "TikTok"]) expect(within(footer).getByLabelText(channel)).toBeVisible();
    await waitFor(() => expect(within(footer).getByLabelText(/whatsapp/i)).toHaveAttribute("href", "https://wa.me/2348030000000"));
  });

  it("announces an active complete-group promotion only when one is returned", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/settings")) return okJson(settings);
      if (url.includes("/api/promotion")) return okJson({ id: "promo-1", name: "Six-piece edit", description: "Build a complete group and save.", requiredQuantity: 6, discountBasisPoints: 1500, startAt: "2026-09-21T00:00:00.000Z", endAt: "2026-09-30T00:00:00.000Z" });
      if (url.includes("/api/wholesale")) return okJson({ items: [], page: 1, pageSize: 3, total: 0 });
      if (url.includes("/api/products")) return okJson({ items: products, page: 1, pageSize: 8, total: products.length });
      if (url.includes("/api/config")) return okJson({ whatsAppNumber: "2348030000000" });
      throw new Error(`Unexpected request: ${url}`);
    });

    renderAt("/");

    expect(await screen.findByRole("region", { name: /current offer/i })).toHaveTextContent("Six-piece edit");
    expect(screen.getByText(/6 eligible items/i)).toBeVisible();
    expect(screen.getByText(/15% off/i)).toBeVisible();
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
