import { describe, expect, it } from "vitest";

import {
  initialRentalFlowState,
  rentalFlowReducer,
  type RentalFlowState,
} from "../../components/features/RentalFlow/rentalFlowReducer";
import type { RentalConfirmation } from "../../lib/validation";

const range = { from: new Date(2026, 5, 10), to: new Date(2026, 5, 12) };
const withRange: RentalFlowState = { ...initialRentalFlowState, range };
const confirmation: RentalConfirmation = {
  confirmationCode: "RMG-TEST",
  itemId: "sony-a7-iv",
  from: "2026-06-10",
  to: "2026-06-12",
  days: 3,
  insurance: 39,
  total: 249.6,
  deposit: 1200,
  createdAt: "2026-06-03T15:00:00.000Z",
};

describe("rentalFlowReducer", () => {
  it("selecting a range clears previous errors", () => {
    const state = { ...initialRentalFlowState, fieldErrors: { to: "x" }, submitError: "y" };
    expect(rentalFlowReducer(state, { type: "SELECT_RANGE", range })).toEqual({ ...withRange });
  });

  it("validation failures send the user back to the dates step with field errors", () => {
    const state = { ...withRange, step: "summary" as const };
    expect(rentalFlowReducer(state, { type: "VALIDATION_FAILED", fieldErrors: { from: "bad" } })).toMatchObject({
      step: "dates",
      fieldErrors: { from: "bad" },
    });
  });

  describe("GO_TO", () => {
    it("moves between steps once a range is complete", () => {
      expect(rentalFlowReducer(withRange, { type: "GO_TO", step: "confirm" }).step).toBe("confirm");
    });

    it("always allows going back to the dates step", () => {
      expect(rentalFlowReducer(initialRentalFlowState, { type: "GO_TO", step: "dates" }).step).toBe("dates");
    });

    it("refuses to leave the dates step without a complete range", () => {
      const partial = { ...initialRentalFlowState, range: { from: range.from, to: undefined } };
      expect(rentalFlowReducer(partial, { type: "GO_TO", step: "summary" })).toBe(partial);
    });

    it("is ignored while submitting or after confirmation", () => {
      const submitting = { ...withRange, step: "confirm" as const, submitting: true };
      const confirmed = { ...withRange, step: "confirmed" as const, confirmation };
      expect(rentalFlowReducer(submitting, { type: "GO_TO", step: "dates" })).toBe(submitting);
      expect(rentalFlowReducer(confirmed, { type: "GO_TO", step: "dates" })).toBe(confirmed);
    });
  });

  it("SUBMIT → SUBMIT_SUCCEEDED ends in the confirmed step", () => {
    const submitting = rentalFlowReducer({ ...withRange, step: "confirm" }, { type: "SUBMIT" });
    expect(submitting).toMatchObject({ submitting: true, submitError: null });
    expect(rentalFlowReducer(submitting, { type: "SUBMIT_SUCCEEDED", confirmation })).toMatchObject({
      submitting: false,
      step: "confirmed",
      confirmation,
    });
  });

  it("SUBMIT_FAILED with field errors returns to the dates step", () => {
    const submitting = { ...withRange, step: "confirm" as const, submitting: true };
    expect(
      rentalFlowReducer(submitting, { type: "SUBMIT_FAILED", message: "Solicitud inválida", fieldErrors: { from: "x" } }),
    ).toMatchObject({ submitting: false, step: "dates", fieldErrors: { from: "x" }, submitError: "Solicitud inválida" });
  });

  it("SUBMIT_FAILED without field errors stays on the confirm step", () => {
    const submitting = { ...withRange, step: "confirm" as const, submitting: true };
    for (const fieldErrors of [undefined, {}]) {
      expect(rentalFlowReducer(submitting, { type: "SUBMIT_FAILED", message: "boom", fieldErrors })).toMatchObject({
        submitting: false,
        step: "confirm",
        submitError: "boom",
      });
    }
  });

  it("an availability conflict clears the range and explains why", () => {
    const state = rentalFlowReducer({ ...withRange, step: "confirm" }, { type: "AVAILABILITY_CONFLICT" });
    expect(state).toMatchObject({ step: "dates", range: undefined });
    expect(state.fieldErrors.from).toMatch(/Alguien acaba de reservar/);
  });

  it("an availability conflict can't undo a confirmed rental", () => {
    const confirmed = { ...withRange, step: "confirmed" as const, confirmation };
    expect(rentalFlowReducer(confirmed, { type: "AVAILABILITY_CONFLICT" })).toBe(confirmed);
  });

  it("RESET starts over", () => {
    const confirmed = { ...withRange, step: "confirmed" as const, confirmation };
    expect(rentalFlowReducer(confirmed, { type: "RESET" })).toBe(initialRentalFlowState);
  });
});
