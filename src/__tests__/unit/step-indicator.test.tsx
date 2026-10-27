import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StepIndicator } from "../../components/features/RentalFlow/StepIndicator";

describe("StepIndicator", () => {
  it("marks the current step and numbers the ones ahead", () => {
    render(<StepIndicator step="summary" />);

    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.getAttribute("aria-current"))).toEqual([null, "step", null]);
    expect(steps[2]).toHaveTextContent("3Confirmación");
  });

  it("marks every step as done once the rental is confirmed", () => {
    render(<StepIndicator step="confirmed" />);

    const steps = screen.getAllByRole("listitem");
    expect(steps.every((step) => !step.hasAttribute("aria-current"))).toBe(true);
    expect(steps.map((step) => step.textContent)).toEqual(["Fechas", "Resumen", "Confirmación"]);
  });
});
