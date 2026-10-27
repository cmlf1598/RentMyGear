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

  it.each(["photography", "Photography", "fotografía", "Fotografía y Video"])(
    "recognizes %s as photography",
    (category) => {
      expect(getInsuranceRate(category)).toBe(0.2);
    },
  );

  it.each(["audio", "camping", "water-sports", "lighting", ""])("treats %j as another category (10%)", (category) => {
    expect(getInsuranceRate(category)).toBe(0.1);
  });
});

describe("calculateInsurance(category, dailyRate, days = 1)", () => {
  it("applies 20% to photography equipment", () => {
    expect(calculateInsurance("photography", 100)).toBe(20);
    expect(calculateInsurance("fotografia-video", 65)).toBe(13);
  });

  it("applies 10% to everything else", () => {
    expect(calculateInsurance("audio", 100)).toBe(10);
    expect(calculateInsurance("deportes-acuaticos", 45)).toBe(4.5);
  });

  it.each([
    { label: "photography, 3 days", category: "fotografia-video", rate: 65, days: 3, expected: 39 },
    { label: "photography, 1 week", category: "photography", rate: 120, days: 7, expected: 168 },
    { label: "photography, 30 days", category: "fotografia-video", rate: 65, days: 30, expected: 390 },
    { label: "water sports, 3 days", category: "deportes-acuaticos", rate: 45, days: 3, expected: 13.5 },
    { label: "mountain, 1 week", category: "montana-camping", rate: 18, days: 7, expected: 12.6 },
    { label: "audio, 4 days", category: "audio", rate: 50, days: 4, expected: 20 },
    { label: "mountain, 30 days", category: "montana-camping", rate: 18, days: 30, expected: 54 },
  ])("multi-day: $label → $expected", ({ category, rate, days, expected }) => {
    expect(calculateInsurance(category, rate, days)).toBe(expected);
  });

  it("scales linearly with the number of days", () => {
    const oneDay = calculateInsurance("photography", 65);
    expect(calculateInsurance("photography", 65, 5)).toBe(oneDay * 5);
  });

  it("rounds to whole cents without floating-point drift", () => {
    // 19.99 × 3 = 59.97 → 20% = 11.994 → 11.99 · 10% = 5.997 → 6.00
    expect(calculateInsurance("fotografia-video", 19.99, 3)).toBe(11.99);
    expect(calculateInsurance("montana-camping", 19.99, 3)).toBe(6);
  });

  it("is zero for free equipment", () => {
    expect(calculateInsurance("photography", 0, 3)).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects %s days", (days) => {
    expect(() => calculateInsurance("photography", 65, days)).toThrow(RangeError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects a daily rate of %s", (rate) => {
    expect(() => calculateInsurance("photography", rate)).toThrow(RangeError);
  });
});
