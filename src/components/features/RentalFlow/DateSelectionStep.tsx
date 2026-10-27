"use client";

import { startOfDay } from "date-fns";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { countRentalDays, formatDateRange, MAX_RENTAL_DAYS } from "@/lib/date-utils";
import type { BookedRange } from "@/types/gear";

interface DateSelectionStepProps {
  range: DateRange | undefined;
  booked: BookedRange[];
  fieldErrors: Record<string, string>;
  checkedAt: Date | null;
  availabilityError: boolean;
  onSelect: (range: DateRange | undefined) => void;
  onContinue: () => void;
}

export function DateSelectionStep({
  range,
  booked,
  fieldErrors,
  checkedAt,
  availabilityError,
  onSelect,
  onContinue,
}: DateSelectionStepProps) {
  const [today] = useState(() => startOfDay(new Date()));
  const complete = Boolean(range?.from && range.to);
  const days = range?.from && range.to ? countRentalDays(range.from, range.to) : 0;
  const errors = [...new Set(Object.values(fieldErrors))];

  return (
    <div className="space-y-5">
      <div className="flex justify-center rounded-2xl bg-secondary/50 p-2">
        <Calendar
          mode="range"
          locale={es}
          selected={range}
          onSelect={onSelect}
          defaultMonth={today}
          startMonth={today}
          disabled={[{ before: today }, ...booked]}
          excludeDisabled
          max={MAX_RENTAL_DAYS - 1}
          modifiers={{ booked }}
          modifiersClassNames={{ booked: "[&>button]:line-through [&>button]:decoration-muted-foreground/60" }}
          className="bg-transparent [--cell-size:--spacing(10)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" /> Seleccionado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground/60 line-through">15</span> No disponible
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5" aria-live="polite">
          <RefreshCw className="size-3" />
          {availabilityError
            ? "Sin conexión con disponibilidad"
            : checkedAt
              ? `Disponibilidad actualizada ${checkedAt.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" })}`
              : "Disponibilidad en tiempo real"}
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm">
        <CalendarDays className="size-4 text-muted-foreground" />
        {range?.from ? (
          <span>
            {range.to ? formatDateRange(range.from, range.to) : "Elige la fecha de devolución"}
            {range.to && (
              <span className="text-muted-foreground"> · {days} {days === 1 ? "día" : "días"}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Elige la fecha de recogida</span>
        )}
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <Button size="lg" className="h-12 w-full rounded-full text-[15px]" disabled={!complete} onClick={onContinue}>
        Continuar
      </Button>
    </div>
  );
}
