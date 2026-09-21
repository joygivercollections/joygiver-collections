import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  adminRequest,
  apiRequest,
  createProduct,
  resetStore,
  seedAdminSession,
} from "./helpers";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await resetStore();
  await seedAdminSession();
});

it("returns only clothing types assigned to the requested audience", async () => {
  const response = await apiRequest("/api/categories?audience=men");
  const categories = (await response.json()) as Array<{
    slug: string;
    audiences: string[];
  }>;

  expect(response.status).toBe(200);
  expect(categories.map((category) => category.slug)).toContain("shirts");
  expect(categories.map((category) => category.slug)).toContain("jeans");
  expect(categories.map((category) => category.slug)).not.toContain("gowns");
  expect(categories.every((category) => category.audiences.includes("men"))).toBe(true);
});

it("round-trips clothing type audience assignments for the owner", async () => {
  const createResponse = await adminRequest("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify({
      name: "Waistcoats",
      displayOrder: 180,
      active: true,
      audiences: ["women", "men"],
    }),
  });
  const created = (await createResponse.json()) as { id: string; audiences: string[] };

  expect(createResponse.status).toBe(201);
  expect(created.audiences).toEqual(["men", "women"]);
});

it("does not remove an audience while products still require it", async () => {
  await createProduct({
    categoryId: "cat_two_piece_sets",
    audiences: ["women", "men"],
  });

  const response = await adminRequest("/api/admin/categories/cat_two_piece_sets", {
    method: "PUT",
    body: JSON.stringify({
      name: "Two-piece Sets",
      displayOrder: 50,
      active: true,
      audiences: ["women"],
    }),
  });

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toMatchObject({
    code: "clothing_type_audience_conflict",
  });
});
