import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectionErrorBoundary } from "../../components/shared/SectionErrorBoundary";

function Broken(): never {
  throw new Error("boom");
}

describe("SectionErrorBoundary", () => {
  it("renders its children when nothing fails", () => {
    render(
      <SectionErrorBoundary name="test">
        <p>contenido</p>
      </SectionErrorBoundary>,
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("replaces only the failed section with the fallback and logs the error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <SectionErrorBoundary name="test" fallback={<p>no disponible</p>}>
          <Broken />
        </SectionErrorBoundary>
        <p>resto de la página</p>
      </>,
    );

    expect(screen.getByText("no disponible")).toBeInTheDocument();
    expect(screen.getByText("resto de la página")).toBeInTheDocument();
    expect(error).toHaveBeenCalledWith("[ErrorBoundary:test]", expect.objectContaining({ message: "boom" }));
  });

  it("renders nothing in place of the section when no fallback is given", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <SectionErrorBoundary name="test">
        <Broken />
      </SectionErrorBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
