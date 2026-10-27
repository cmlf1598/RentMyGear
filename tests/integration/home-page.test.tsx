// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { CATEGORY_LIST } from "@/config/categories";

describe("root page (src/app/page.tsx)", () => {
  it("renders the hero copy, a carousel placeholder and one link per category", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("El equipo perfecto para tu próxima aventura.");
    // HeroCarousel is an async Server Component; outside Next.js it stays on its Suspense fallback.
    expect(screen.getByRole("region", { name: "Equipos destacados" })).toBeInTheDocument();
    for (const category of CATEGORY_LIST) {
      expect(screen.getByRole("link", { name: new RegExp(category.name) })).toHaveAttribute(
        "href",
        `/category/${category.id}`,
      );
    }
  });
});
