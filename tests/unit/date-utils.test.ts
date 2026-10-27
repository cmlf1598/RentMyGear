import { describe, expect, it } from "vitest";

import {
  calculateRentalPrice,
  countRentalDays,
  formatCurrency,
  isRangeAvailable,
  MAX_RENTAL_DAYS,
  resolveBookedRanges,
  SERVICE_FEE_RATE,
} from "@/lib/date-utils";

/** Local calendar day (month is 1-based for readability). */
const day = (year: number, month: number, date: number, hours = 0, minutes = 0) =>
  new Date(year, month - 1, date, hours, minutes);

const DAILY_RATE = 65;
const DEPOSIT = 1200;

describe("calculateRentalPrice", () => {
  it.each([
    { label: "1 day (same-day pickup and return)", from: day(2026, 6, 10), to: day(2026, 6, 10), days: 1, total: 70.2 },
    { label: "2 consecutive days", from: day(2026, 6, 10), to: day(2026, 6, 11), days: 2, total: 140.4 },
    { label: "1 week", from: day(2026, 6, 1), to: day(2026, 6, 7), days: 7, total: 491.4 },
    { label: "1 week + 1 day", from: day(2026, 6, 1), to: day(2026, 6, 8), days: 8, total: 561.6 },
    { label: "maximum length (30 days)", from: day(2026, 6, 1), to: day(2026, 6, 30), days: 30, total: 2106 },
  ])("bills $label inclusively → $days days", ({ from, to, days, total }) => {
    const price = calculateRentalPrice(DAILY_RATE, from, to, DEPOSIT);

    expect(price.days).toBe(days);
    expect(price.subtotal).toBe(DAILY_RATE * days);
    expect(price.total).toBe(total);
  });

  describe("across different months", () => {
    it.each([
      { label: "Jan 30 → Feb 2 (31-day month)", from: day(2026, 1, 30), to: day(2026, 2, 2), days: 4 },
      { label: "Apr 29 → May 3 (30-day month)", from: day(2026, 4, 29), to: day(2026, 5, 3), days: 5 },
      { label: "Feb 27 → Mar 2 in a common year", from: day(2026, 2, 27), to: day(2026, 3, 2), days: 4 },
      { label: "Feb 27 → Mar 2 in a leap year", from: day(2028, 2, 27), to: day(2028, 3, 2), days: 5 },
      { label: "Dec 30 → Jan 2 (across years)", from: day(2026, 12, 30), to: day(2027, 1, 2), days: 4 },
      { label: "Jun 20 → Jul 19 (30 days over two months)", from: day(2026, 6, 20), to: day(2026, 7, 19), days: 30 },
    ])("$label → $days days", ({ from, to, days }) => {
      const price = calculateRentalPrice(DAILY_RATE, from, to);
      expect(price.days).toBe(days);
      expect(price.subtotal).toBe(DAILY_RATE * days);
    });
  });

  describe("daylight-saving transitions (TZ=America/New_York)", () => {
    it.each([
      { label: "spring forward (Mar 8, 2026)", from: day(2026, 3, 7), to: day(2026, 3, 9), days: 3 },
      { label: "fall back (Nov 1, 2026)", from: day(2026, 10, 31), to: day(2026, 11, 2), days: 3 },
    ])("$label still counts calendar days", ({ from, to, days }) => {
      // Guard: the range really crosses a UTC-offset change, so this test can't pass vacuously.
      expect(from.getTimezoneOffset()).not.toBe(to.getTimezoneOffset());
      expect(calculateRentalPrice(DAILY_RATE, from, to).days).toBe(days);
    });
  });

  it("ignores the time of day of pickup and return", () => {
    const price = calculateRentalPrice(DAILY_RATE, day(2026, 6, 1, 23, 59), day(2026, 6, 2, 0, 1));
    expect(price.days).toBe(2);
  });

  it("computes in cents, so totals have no floating-point drift", () => {
    // 19.99 × 3 = 59.97; fee = round(5997 × 0.08 = 479.76) = 4.80
    const price = calculateRentalPrice(19.99, day(2026, 6, 1), day(2026, 6, 3));

    expect(price.subtotal).toBe(59.97);
    expect(price.serviceFee).toBe(4.8);
    expect(price.total).toBe(64.77);
  });

  it("charges the service fee on the subtotal and keeps the deposit out of the total", () => {
    const price = calculateRentalPrice(DAILY_RATE, day(2026, 6, 1), day(2026, 6, 3), DEPOSIT);

    expect(price.serviceFee).toBeCloseTo(DAILY_RATE * 3 * SERVICE_FEE_RATE, 10);
    expect(price.deposit).toBe(DEPOSIT);
    expect(price.total).toBe(price.subtotal + price.serviceFee);
  });

  it("builds Spanish line items with singular/plural days", () => {
    const single = calculateRentalPrice(DAILY_RATE, day(2026, 6, 1), day(2026, 6, 1));
    const week = calculateRentalPrice(DAILY_RATE, day(2026, 6, 1), day(2026, 6, 7));

    expect(single.lineItems[0]).toEqual({ label: `${formatCurrency(65)} × 1 día`, amount: 65 });
    expect(week.lineItems[0]).toEqual({ label: `${formatCurrency(65)} × 7 días`, amount: 455 });
    expect(week.lineItems[1]).toEqual({ label: "Cargo por servicio (8%)", amount: 36.4 });
  });

  it("rejects a return date before the pickup date", () => {
    expect(() => calculateRentalPrice(DAILY_RATE, day(2026, 6, 5), day(2026, 6, 4))).toThrow(RangeError);
  });
});

describe("countRentalDays", () => {
  it("matches the price calculation for every length up to the maximum", () => {
    for (let length = 1; length <= MAX_RENTAL_DAYS; length++) {
      const to = day(2026, 1, 20 + length - 1);
      expect(countRentalDays(day(2026, 1, 20), to)).toBe(length);
      expect(calculateRentalPrice(DAILY_RATE, day(2026, 1, 20), to).days).toBe(length);
    }
  });
});

describe("isRangeAvailable", () => {
  const booked = [{ from: day(2026, 6, 10), to: day(2026, 6, 12) }];

  it.each([
    { label: "ends the day before a booking", from: day(2026, 6, 7), to: day(2026, 6, 9), available: true },
    { label: "starts the day after a booking", from: day(2026, 6, 13), to: day(2026, 6, 15), available: true },
    { label: "ends on a booking's first day", from: day(2026, 6, 8), to: day(2026, 6, 10), available: false },
    { label: "starts on a booking's last day", from: day(2026, 6, 12), to: day(2026, 6, 14), available: false },
    { label: "surrounds a booking", from: day(2026, 6, 1), to: day(2026, 6, 20), available: false },
  ])("$label → available: $available", ({ from, to, available }) => {
    expect(isRangeAvailable(from, to, booked)).toBe(available);
  });
});

describe("resolveBookedRanges", () => {
  it("turns day offsets into inclusive ranges relative to today", () => {
    const [range] = resolveBookedRanges([{ startInDays: 2, lengthDays: 3 }], day(2026, 6, 30, 15));

    expect(range).toEqual({ from: day(2026, 7, 2), to: day(2026, 7, 4) });
    expect(countRentalDays(range.from, range.to)).toBe(3);
  });
});
