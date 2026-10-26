import type { DateRange } from "react-day-picker";

import type { RentalConfirmation } from "@/lib/validation";

export type RentalStep = "dates" | "summary" | "confirm" | "confirmed";

export const STEP_ORDER: Exclude<RentalStep, "confirmed">[] = ["dates", "summary", "confirm"];

export interface RentalFlowState {
  step: RentalStep;
  range: DateRange | undefined;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  submitError: string | null;
  confirmation: RentalConfirmation | null;
}

export type RentalFlowAction =
  | { type: "SELECT_RANGE"; range: DateRange | undefined }
  | { type: "VALIDATION_FAILED"; fieldErrors: Record<string, string> }
  | { type: "GO_TO"; step: Exclude<RentalStep, "confirmed"> }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCEEDED"; confirmation: RentalConfirmation }
  | { type: "SUBMIT_FAILED"; message: string; fieldErrors?: Record<string, string> }
  | { type: "AVAILABILITY_CONFLICT" }
  | { type: "RESET" };

export const initialRentalFlowState: RentalFlowState = {
  step: "dates",
  range: undefined,
  fieldErrors: {},
  submitting: false,
  submitError: null,
  confirmation: null,
};

/** Pure state machine for the rental wizard: dates → summary → confirm → confirmed. */
export function rentalFlowReducer(state: RentalFlowState, action: RentalFlowAction): RentalFlowState {
  switch (action.type) {
    case "SELECT_RANGE":
      return { ...state, range: action.range, fieldErrors: {}, submitError: null };
    case "VALIDATION_FAILED":
      return { ...state, step: "dates", fieldErrors: action.fieldErrors };
    case "GO_TO":
      if (state.submitting || state.step === "confirmed") return state;
      if (action.step !== "dates" && !(state.range?.from && state.range.to)) return state;
      return { ...state, step: action.step, submitError: null };
    case "SUBMIT":
      return { ...state, submitting: true, submitError: null };
    case "SUBMIT_SUCCEEDED":
      return { ...state, submitting: false, step: "confirmed", confirmation: action.confirmation };
    case "SUBMIT_FAILED":
      return action.fieldErrors && Object.keys(action.fieldErrors).length > 0
        ? { ...state, submitting: false, step: "dates", fieldErrors: action.fieldErrors, submitError: action.message }
        : { ...state, submitting: false, submitError: action.message };
    case "AVAILABILITY_CONFLICT":
      if (state.step === "confirmed") return state;
      return {
        ...state,
        step: "dates",
        range: undefined,
        fieldErrors: { from: "Alguien acaba de reservar parte de esas fechas. Elige otras, por favor." },
      };
    case "RESET":
      return initialRentalFlowState;
  }
}
