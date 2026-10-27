import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "../../app/page";
import { CATEGORY_LIST } from "../../config/categories";
import { formatCurrency } from "../../lib/date-utils";
import { getInsuranceRate } from "../../lib/insurance";
import { inventoryService } from "../../services/inventoryService";

const topRated = (categoryId: (typeof CATEGORY_LIST)[number]["id"]) =>
  [...inventoryService.getByCategory(categoryId)].sort((a, b) => b.rating - a.rating).slice(0, 3);

describe("root page (src/app/page.tsx)", () => {
  it("renders the hero copy and a carousel placeholder", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("El equipo perfecto para tu próxima aventura.");
    // HeroCarousel is an async Server Component; outside Next.js it stays on its Suspense fallback.
    expect(screen.getByRole("region", { name: "Equipos destacados" })).toBeInTheDocument();
  });

  it("links to every category", () => {
    render(<HomePage />);

    for (const category of CATEGORY_LIST) {
      expect(screen.getAllByRole("link", { name: new RegExp(category.name) })[0]).toHaveAttribute(
        "href",
        `/category/${category.id}`,
      );
    }
  });

  it("explains Smart Insurance: 20% for photography, 10% for everything else", () => {
    render(<HomePage />);

    const highlight = screen.getByRole("heading", { level: 3, name: "Seguro inteligente" }).parentElement!;
    expect(highlight).toHaveTextContent("20%");
    expect(highlight).toHaveTextContent("10%");
  });

  describe("rates by category", () => {
    it.each(CATEGORY_LIST.map((category) => [category.name, category] as const))(
      "%s: insurance rate and the top-rated items with their daily price",
      (_, category) => {
        render(<HomePage />);

        const section = screen.getByRole("region", { name: "Tarifas y seguro por categoría" });
        const card = within(section).getByRole("article", { name: category.name });
        const rate = `${Math.round(getInsuranceRate(category.id) * 100)}%`;
        expect(card).toHaveTextContent(`Seguro inteligente ${rate}`);

        const items = within(card).getAllByRole("listitem");
        expect(items).toHaveLength(3);
        topRated(category.id).forEach((item, index) => {
          expect(within(items[index]).getByRole("link", { name: new RegExp(item.name.slice(0, 12)) })).toHaveAttribute(
            "href",
            `/gear/${item.id}`,
          );
          expect(items[index]).toHaveTextContent(`${formatCurrency(item.dailyRate)} / día`);
        });
      },
    );
  });
});
