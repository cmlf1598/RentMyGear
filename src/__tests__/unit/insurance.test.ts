import { describe, expect, it } from "vitest";

import {
  calculateInsurance,
  DEFAULT_INSURANCE_RATE,
  getInsuranceRate,
  PHOTOGRAPHY_INSURANCE_RATE,
} from "../../lib/insurance";
import { CATEGORY_IDS } from "../../types/gear";

describe("getInsuranceRate", () => {
  it("charges 20% for photography equipment", () => {
    expect(PHOTOGRAPHY_INSURANCE_RATE).toBe(0.2);
    expect(getInsuranceRate("fotografia-video")).toBe(0.2);
  });

  it.each(["montana-camping", "deportes-acuaticos"] as const)("charges 10% for %s", (category) => {
    expect(DEFAULT_INSURANCE_RATE).toBe(0.1);
    expect(getInsuranceRate(category)).toBe(0.1);
  });

  it("gives every category a rate, and only photography gets 20%", () => {
    const rates = CATEGORY_IDS.map((id) => [id, getInsuranceRate(id)] as const);
    expect(rates.filter(([, rate]) => rate === 0.2).map(([id]) => id)).toEqual(["fotografia-video"]);
    expect(rates.every(([, rate]) => rate === 0.1 || rate === 0.2)).toBe(true);
  });
});

describe("calculateInsurance", () => {
  it.each([
    { label: "photography, 1 day", rate: 65, days: 1, category: "fotografia-video", expected: 13 },
    { label: "photography, 3 days", rate: 65, days: 3, category: "fotografia-video", expected: 39 },
    { label: "photography, 1 week", rate: 120, days: 7, category: "fotografia-video", expected: 168 },
    { label: "photography, 30 days", rate: 65, days: 30, category: "fotografia-video", expected: 390 },
    { label: "water sports, 1 day", rate: 45, days: 1, category: "deportes-acuaticos", expected: 4.5 },
    { label: "water sports, 3 days", rate: 45, days: 3, category: "deportes-acuaticos", expected: 13.5 },
    { label: "mountain, 1 week", rate: 18, days: 7, category: "montana-camping", expected: 12.6 },
    { label: "mountain, 30 days", rate: 18, days: 30, category: "montana-camping", expected: 54 },
  ] as const)("$label → $expected", ({ rate, days, category, expected }) => {
    expect(calculateInsurance(rate, days, category)).toBe(expected);
  });

  it("scales linearly with the number of days", () => {
    const oneDay = calculateInsurance(65, 1, "fotografia-video");
    expect(calculateInsurance(65, 5, "fotografia-video")).toBe(oneDay * 5);
  });

  it("rounds to whole cents without floating-point drift", () => {
    // 19.99 × 3 = 59.97 → 20% = 11.994 → 11.99 · 10% = 5.997 → 6.00
    expect(calculateInsurance(19.99, 3, "fotografia-video")).toBe(11.99);
    expect(calculateInsurance(19.99, 3, "montana-camping")).toBe(6);
  });

  it("is zero for free equipment", () => {
    expect(calculateInsurance(0, 3, "fotografia-video")).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects %s days", (days) => {
    expect(() => calculateInsurance(65, days, "fotografia-video")).toThrow(RangeError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects a daily rate of %s", (rate) => {
    expect(() => calculateInsurance(rate, 1, "fotografia-video")).toThrow(RangeError);
  });
});
