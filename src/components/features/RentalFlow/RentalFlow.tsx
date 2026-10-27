"use client";

import { useMemo, useReducer } from "react";
import { toast } from "sonner";

import { calculateRentalPrice, formatCurrency, isRangeAvailable } from "@/lib/date-utils";
import {
  createRentalRequestSchema,
  RentalConfirmationSchema,
  toDateOnly,
  toFieldErrors,
} from "@/lib/validation";
import type { BookedRangeISO } from "@/types/gear";

import { ConfirmationStep, RentalConfirmedState } from "./ConfirmationStep";
import { DateSelectionStep } from "./DateSelectionStep";
import { PriceSummaryStep } from "./PriceSummaryStep";
import { initialRentalFlowState, rentalFlowReducer } from "./rentalFlowReducer";
import { StepIndicator } from "./StepIndicator";
import { useAvailability } from "./useAvailability";

export interface RentalFlowProps {
  item: { id: string; name: string; dailyRate: number; deposit: number };
  initialBookedRanges: BookedRangeISO[];
}

/** Multi-step rental wizard: Date Selection → Price Summary → Mock Confirmation. */
export function RentalFlow({ item, initialBookedRanges }: RentalFlowProps) {
  const [state, dispatch] = useReducer(rentalFlowReducer, initialRentalFlowState);
  const availability = useAvailability(item.id, initialBookedRanges);
  const { range } = state;

  const price = useMemo(
    () => (range?.from && range.to ? calculateRentalPrice(item.dailyRate, range.from, range.to, item.deposit) : null),
    [item.dailyRate, item.deposit, range],
  );

  const validate = () => {
    const result = createRentalRequestSchema({ bookedRanges: availability.booked }).safeParse({
      itemId: item.id,
      from: range?.from,
      to: range?.to,
    });
    if (!result.success) {
      dispatch({ type: "VALIDATION_FAILED", fieldErrors: toFieldErrors(result.error) });
      return false;
    }
    return true;
  };

  const confirm = async () => {
    if (!range?.from || !range.to) return;

    // Re-check against the freshest availability right before booking.
    const latest = await availability.refresh();
    if (latest && !isRangeAvailable(range.from, range.to, latest)) {
      dispatch({ type: "AVAILABILITY_CONFLICT" });
      toast.error("Esas fechas ya no están disponibles");
      return;
    }

    dispatch({ type: "SUBMIT" });
    try {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, from: toDateOnly(range.from), to: toDateOnly(range.to) }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const { error, fieldErrors } = body as { error?: string; fieldErrors?: Record<string, string> };
        console.warn("[RentalFlow] rental rejected", { status: response.status, body });
        dispatch({ type: "SUBMIT_FAILED", message: error ?? "No pudimos confirmar la renta", fieldErrors });
        toast.error(error ?? "No pudimos confirmar la renta");
        return;
      }

      const confirmation = RentalConfirmationSchema.parse(body);
      dispatch({ type: "SUBMIT_SUCCEEDED", confirmation });
      toast.success("¡Renta confirmada!", {
        description: `${item.name} · ${formatCurrency(confirmation.total)} · ${confirmation.confirmationCode}`,
      });
    } catch (error) {
      console.error("[RentalFlow] rental request failed", error);
      dispatch({ type: "SUBMIT_FAILED", message: "Error de conexión. Inténtalo de nuevo." });
      toast.error("Error de conexión. Inténtalo de nuevo.");
    }
  };

  if (state.step === "confirmed" && state.confirmation) {
    return (
      <RentalConfirmedState
        itemName={item.name}
        confirmation={state.confirmation}
        onReset={() => dispatch({ type: "RESET" })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <StepIndicator step={state.step} />

      {state.step === "dates" && (
        <DateSelectionStep
          range={range}
          booked={availability.booked}
          fieldErrors={state.fieldErrors}
          checkedAt={availability.checkedAt}
          availabilityError={availability.error}
          onSelect={(next) => dispatch({ type: "SELECT_RANGE", range: next })}
          onContinue={() => validate() && dispatch({ type: "GO_TO", step: "summary" })}
        />
      )}

      {state.step === "summary" && range?.from && range.to && price && (
        <PriceSummaryStep
          from={range.from}
          to={range.to}
          price={price}
          onBack={() => dispatch({ type: "GO_TO", step: "dates" })}
          onContinue={() => dispatch({ type: "GO_TO", step: "confirm" })}
        />
      )}

      {state.step === "confirm" && range?.from && range.to && price && (
        <ConfirmationStep
          itemName={item.name}
          from={range.from}
          to={range.to}
          price={price}
          submitting={state.submitting}
          submitError={state.submitError}
          onBack={() => dispatch({ type: "GO_TO", step: "summary" })}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}
