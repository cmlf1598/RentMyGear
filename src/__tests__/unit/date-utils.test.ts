import { describe, expect, it } from "vitest";

import {
  calculateRentalPrice,
  countRentalDays,
  formatCurrency,
  formatDate,
  formatDateRange,
  fromISORanges,
  isRangeAvailable,
  MAX_RENTAL_DAYS,
  resolveBookedRanges,
  SERVICE_FEE_RATE,
  toISORanges,
} from "../../lib/date-utils";

/** Local calendar day (month is 1-based for readability). */
const day = (year: number, month: number, date: number, hours = 0, minutes = 0) =>
  new Date(year, month - 1, date, hours, minutes);

const CAMERA = { dailyRate: 65, deposit: 1200, category: "fotografia-video" } as const;
const KAYAK = { dailyRate: 45, deposit: 450, category: "deportes-acuaticos" } as const;
const TENT = { dailyRate: 18, deposit: 150, category: "montana-camping" } as const;

describe("calculateRentalPrice", () => {
  it.each([
    { label: "1 day (same-day pickup and return)", from: day(2026, 6, 10), to: day(2026, 6, 10), days: 1, total: 83.2 },
    { label: "2 consecutive days", from: day(2026, 6, 10), to: day(2026, 6, 11), days: 2, total: 166.4 },
    { label: "1 week", from: day(2026, 6, 1), to: day(2026, 6, 7), days: 7, total: 582.4 },
    { label: "1 week + 1 day", from: day(2026, 6, 1), to: day(2026, 6, 8), days: 8, total: 665.6 },
    { label: "maximum length (30 days)", from: day(2026, 6, 1), to: day(2026, 6, 30), days: 30, total: 2496 },
  ])("bills $label inclusively → $days days", ({ from, to, days, total }) => {
    const price = calculateRentalPrice(CAMERA, from, to);

    expect(price.days).toBe(days);
    expect(price.subtotal).toBe(CAMERA.dailyRate * days);
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
      const price = calculateRentalPrice(CAMERA, from, to);
      expect(price.days).toBe(days);
      expect(price.subtotal).toBe(CAMERA.dailyRate * days);
    });
  });

  describe("daylight-saving transitions (TZ=America/New_York)", () => {
    it.each([
      { label: "spring forward (Mar 8, 2026)", from: day(2026, 3, 7), to: day(2026, 3, 9), days: 3 },
      { label: "fall back (Nov 1, 2026)", from: day(2026, 10, 31), to: day(2026, 11, 2), days: 3 },
    ])("$label still counts calendar days", ({ from, to, days }) => {
      // Guard: the range really crosses a UTC-offset change, so this test can't pass vacuously.
      expect(from.getTimezoneOffset()).not.toBe(to.getTimezoneOffset());
      expect(calculateRentalPrice(CAMERA, from, to).days).toBe(days);
    });
  });

  it("ignores the time of day of pickup and return", () => {
    const price = calculateRentalPrice(CAMERA, day(2026, 6, 1, 23, 59), day(2026, 6, 2, 0, 1));
    expect(price.days).toBe(2);
  });

  describe("Smart Insurance", () => {
    it("adds 20% of the rental for photography equipment", () => {
      const price = calculateRentalPrice(CAMERA, day(2026, 6, 1), day(2026, 6, 3));

      expect(price.insuranceRate).toBe(0.2);
      expect(price.insurance).toBe(39); // 65 × 3 × 20%
      expect(price.total).toBe(195 + 39 + 15.6);
    });

    it("adds 10% of the rental for other categories", () => {
      const water = calculateRentalPrice(KAYAK, day(2026, 6, 10), day(2026, 6, 12));
      const mountain = calculateRentalPrice(TENT, day(2026, 6, 1), day(2026, 6, 7));

      expect(water).toMatchObject({ insuranceRate: 0.1, insurance: 13.5, total: 159.3 });
      expect(mountain).toMatchObject({ insuranceRate: 0.1, insurance: 12.6, total: 148.68 });
    });

    it("charges the service fee on the rental only, not on the insurance", () => {
      const price = calculateRentalPrice(CAMERA, day(2026, 6, 1), day(2026, 6, 3));
      expect(price.serviceFee).toBeCloseTo(price.subtotal * SERVICE_FEE_RATE, 10);
    });
  });

  it("computes in cents, so totals have no floating-point drift", () => {
    // 19.99 × 3 = 59.97 · insurance 20% = 11.994 → 11.99 · fee 8% = 4.7976 → 4.80
    const price = calculateRentalPrice({ ...CAMERA, dailyRate: 19.99 }, day(2026, 6, 1), day(2026, 6, 3));

    expect(price.subtotal).toBe(59.97);
    expect(price.insurance).toBe(11.99);
    expect(price.serviceFee).toBe(4.8);
    expect(price.total).toBe(76.76);
  });

  it("keeps the refundable deposit out of the total", () => {
    const price = calculateRentalPrice(CAMERA, day(2026, 6, 1), day(2026, 6, 3));

    expect(price.deposit).toBe(CAMERA.deposit);
    expect(price.total).toBe(price.subtotal + price.insurance + price.serviceFee);
  });

  it("treats a missing deposit as zero", () => {
    const price = calculateRentalPrice({ dailyRate: 65, category: "fotografia-video" }, day(2026, 6, 1), day(2026, 6, 1));
    expect(price.deposit).toBe(0);
  });

  it("builds Spanish line items: rental (singular/plural days), insurance, service fee", () => {
    const single = calculateRentalPrice(CAMERA, day(2026, 6, 1), day(2026, 6, 1));
    const week = calculateRentalPrice(KAYAK, day(2026, 6, 1), day(2026, 6, 7));

    expect(single.lineItems).toEqual([
      { label: `${formatCurrency(65)} × 1 día`, amount: 65 },
      { label: "Seguro inteligente (20%)", amount: 13 },
      { label: "Cargo por servicio (8%)", amount: 5.2 },
    ]);
    expect(week.lineItems).toEqual([
      { label: `${formatCurrency(45)} × 7 días`, amount: 315 },
      { label: "Seguro inteligente (10%)", amount: 31.5 },
      { label: "Cargo por servicio (8%)", amount: 25.2 },
    ]);
  });

  it("rejects a return date before the pickup date", () => {
    expect(() => calculateRentalPrice(CAMERA, day(2026, 6, 5), day(2026, 6, 4))).toThrow(RangeError);
  });
});

describe("countRentalDays", () => {
  it("matches the price calculation for every length up to the maximum", () => {
    for (let length = 1; length <= MAX_RENTAL_DAYS; length++) {
      const to = day(2026, 1, 20 + length - 1);
      expect(countRentalDays(day(2026, 1, 20), to)).toBe(length);
      expect(calculateRentalPrice(CAMERA, day(2026, 1, 20), to).days).toBe(length);
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

  it("defaults to the current date", () => {
    const [range] = resolveBookedRanges([{ startInDays: 0, lengthDays: 1 }]);
    expect(countRentalDays(new Date(), range.from)).toBe(1);
  });
});

describe("ISO range serialization", () => {
  it("round-trips booked ranges through ISO strings", () => {
    const ranges = [{ from: day(2026, 6, 10), to: day(2026, 6, 12) }];
    const iso = toISORanges(ranges);

    expect(iso).toEqual([{ from: ranges[0].from.toISOString(), to: ranges[0].to.toISOString() }]);
    expect(fromISORanges(iso)).toEqual(ranges);
  });
});

describe("formatting", () => {
  it("formats USD amounts for the es-US locale", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats dates in Spanish", () => {
    expect(formatDate(day(2026, 6, 10))).toBe("10 de junio, 2026");
    expect(formatDate(day(2026, 6, 10), "d 'de' MMM")).toBe("10 de jun");
  });

  it("omits the first year when both dates fall in the same year", () => {
    expect(formatDateRange(day(2026, 6, 10), day(2026, 6, 12))).toBe("10 de jun – 12 de jun, 2026");
    expect(formatDateRange(day(2026, 12, 30), day(2027, 1, 2))).toBe("30 de dic, 2026 – 2 de ene, 2027");
  });
});
