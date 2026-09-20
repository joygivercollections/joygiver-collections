import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { App } from "../../app/App";

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
