import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SocialLinks } from "../../app/components/SocialLinks";

it("links Instagram and TikTok while Facebook remains unavailable", () => {
  render(<SocialLinks whatsAppNumber="2348069010690" />);

  expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
    "href",
    "https://www.instagram.com/joygivercollections001/",
  );
  expect(screen.getByRole("link", { name: "TikTok" })).toHaveAttribute(
    "href",
    "https://www.tiktok.com/@joygivercollections",
  );
  expect(screen.queryByRole("link", { name: "Facebook" })).not.toBeInTheDocument();
});
