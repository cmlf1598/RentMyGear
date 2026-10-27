import { describe, expect, it } from "vitest";

import { MAX_RENTAL_DAYS } from "../../lib/date-utils";
import { createRentalRequestSchema, toFieldErrors } from "../../lib/validation";

const TODAY = new Date(2026, 5, 1, 9, 30);
const now = () => TODAY;

function validate(from: string, to: string, bookedRanges: { from: Date; to: Date }[] = []) {
  const result = createRentalRequestSchema({ now, bookedRanges }).safeParse({ itemId: "sony-a7-iv", from, to });
  return result.success ? { ok: true as const, data: result.data } : { ok: false as const, errors: toFieldErrors(result.error) };
}

describe("createRentalRequestSchema", () => {
  it.each([
    { label: "same day", to: "2026-06-01" },
    { label: "1 week", to: "2026-06-07" },
    { label: "more than a week (8 days)", to: "2026-06-08" },
    { label: "the 30-day maximum", to: "2026-06-30" },
  ])("accepts $label", ({ to }) => {
    expect(validate("2026-06-01", to).ok).toBe(true);
  });

  it("rejects rentals longer than the maximum with a message that matches the rule", () => {
    const result = validate("2026-06-01", "2026-07-01");

    expect(result).toEqual({ ok: false, errors: { to: `El periodo máximo de renta es de ${MAX_RENTAL_DAYS} días` } });
  });

  it("parses yyyy-MM-dd strings as local calendar days", () => {
    const result = validate("2026-06-01", "2026-06-03");

    expect(result.ok && result.data.from).toEqual(new Date(2026, 5, 1));
    expect(result.ok && result.data.to).toEqual(new Date(2026, 5, 3));
  });

  it("rejects dates in the past but allows today", () => {
    expect(validate("2026-05-31", "2026-06-02")).toMatchObject({
      ok: false,
      errors: { from: "La fecha de inicio no puede estar en el pasado" },
    });
    expect(validate("2026-06-01", "2026-06-01").ok).toBe(true);
  });

  it("rejects a return date before the pickup date", () => {
    expect(validate("2026-06-05", "2026-06-03")).toMatchObject({
      ok: false,
      errors: { to: "La devolución debe ser igual o posterior a la fecha de inicio" },
    });
  });

  it("rejects ranges that overlap a booking", () => {
    const booked = [{ from: new Date(2026, 5, 10), to: new Date(2026, 5, 12) }];

    expect(validate("2026-06-08", "2026-06-10", booked)).toMatchObject({
      ok: false,
      errors: { from: "Las fechas seleccionadas incluyen días no disponibles" },
    });
    expect(validate("2026-06-13", "2026-06-20", booked).ok).toBe(true);
  });

  it("files issues that have no field under 'form'", () => {
    const result = createRentalRequestSchema({ now }).safeParse(null);

    expect(result.success).toBe(false);
    expect(result.success ? null : toFieldErrors(result.error)).toEqual({ form: expect.any(String) });
  });

  it("requires both dates", () => {
    const result = createRentalRequestSchema({ now }).safeParse({ itemId: "sony-a7-iv" });
    expect(result.success).toBe(false);
  });
});
