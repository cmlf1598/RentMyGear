import { Check } from "lucide-react";

import { cn } from "../../../lib/utils";

import { STEP_ORDER, type RentalStep } from "./rentalFlowReducer";

const LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  dates: "Fechas",
  summary: "Resumen",
  confirm: "Confirmación",
};

export function StepIndicator({ step }: { step: RentalStep }) {
  const currentIndex = step === "confirmed" ? STEP_ORDER.length : STEP_ORDER.indexOf(step);

  return (
    <ol className="flex items-center gap-2" aria-label="Progreso de la renta">
      {STEP_ORDER.map((key, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={key} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                done && "bg-brand text-brand-foreground",
                active && "bg-foreground text-background",
                !done && !active && "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("text-xs font-medium", active || done ? "text-foreground" : "text-muted-foreground")}>
              {LABELS[key]}
            </span>
            {index < STEP_ORDER.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
