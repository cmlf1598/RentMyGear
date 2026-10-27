import { format, parseISO, startOfDay } from "date-fns";
import { z } from "zod";

import { countRentalDays, isRangeAvailable, MAX_RENTAL_DAYS } from "./date-utils";
import type { BookedRange } from "../types/gear";

export interface RentalSchemaOptions {
  /** Injectable clock so validation is deterministic in tests. */
  now?: () => Date;
  bookedRanges?: BookedRange[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Serializes a calendar day without a time/zone component (avoids off-by-one across time zones). */
export function toDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Accepts Date objects or "yyyy-MM-dd" strings, parsing the latter as a local calendar day. */
const calendarDay = (requiredMessage: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && DATE_ONLY.test(value) ? parseISO(value) : value),
    z.coerce.date({ error: requiredMessage }),
  );

/**
 * Builds the rental request schema. Shared by the client (inline form errors)
 * and the server (authoritative check in POST /api/rentals).
 */
export function createRentalRequestSchema({ now = () => new Date(), bookedRanges = [] }: RentalSchemaOptions = {}) {
  const notInPast = (date: Date) => startOfDay(date) >= startOfDay(now());

  return z
    .object({
      itemId: z.string().min(1, "Selecciona un equipo"),
      from: calendarDay("Selecciona la fecha de inicio").refine(
        notInPast,
        "La fecha de inicio no puede estar en el pasado",
      ),
      to: calendarDay("Selecciona la fecha de devolución").refine(
        notInPast,
        "La fecha de devolución no puede estar en el pasado",
      ),
    })
    .superRefine((value, ctx) => {
      if (startOfDay(value.to) < startOfDay(value.from)) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: "La devolución debe ser igual o posterior a la fecha de inicio",
        });
        return;
      }
      if (countRentalDays(value.from, value.to) > MAX_RENTAL_DAYS) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: `El periodo máximo de renta es de ${MAX_RENTAL_DAYS} días`,
        });
      }
      if (!isRangeAvailable(value.from, value.to, bookedRanges)) {
        ctx.addIssue({
          code: "custom",
          path: ["from"],
          message: "Las fechas seleccionadas incluyen días no disponibles",
        });
      }
    });
}

export type RentalRequest = z.infer<ReturnType<typeof createRentalRequestSchema>>;

/** Shape of the mock API response, validated on the client before rendering. */
export const RentalConfirmationSchema = z.object({
  confirmationCode: z.string(),
  itemId: z.string(),
  from: z.string(),
  to: z.string(),
  days: z.int().positive(),
  insurance: z.number().nonnegative(),
  total: z.number().nonnegative(),
  deposit: z.number().nonnegative(),
  createdAt: z.string(),
});

export type RentalConfirmation = z.infer<typeof RentalConfirmationSchema>;

/** Flattens Zod issues to `{ field: firstMessage }` for form display / API responses. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return fields;
}
