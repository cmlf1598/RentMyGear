import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "../../app/page";

// Outside Next.js the carousel's connection() throws; any carousel error must stay contained.
vi.mock("../../components/features/HeroCarousel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../components/features/HeroCarousel")>()),
  HeroCarousel: () => {
    throw new Error("carousel failed");
  },
}));

describe("root page resilience", () => {
  it("keeps the rest of the page when the hero carousel fails", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<HomePage />);

    expect(error).toHaveBeenCalledWith("[ErrorBoundary:hero]", expect.objectContaining({ message: "carousel failed" }));
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tarifas y seguro por categoría" })).toHaveTextContent(/\$\d/);
  });
});
