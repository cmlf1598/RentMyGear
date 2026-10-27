import type { CategoryId } from "../types/gear";

/** Smart Insurance: photography and video gear is riskier to rent, so it carries a higher rate. */
export const PHOTOGRAPHY_INSURANCE_RATE = 0.2;
export const DEFAULT_INSURANCE_RATE = 0.1;

export function getInsuranceRate(category: CategoryId): number {
  return category === "fotografia-video" ? PHOTOGRAPHY_INSURANCE_RATE : DEFAULT_INSURANCE_RATE;
}

/** Insurance for the whole rental: rate × daily price × days, rounded to whole cents. */
export function calculateInsurance(dailyRate: number, days: number, category: CategoryId): number {
  if (!Number.isFinite(dailyRate) || dailyRate < 0) {
    throw new RangeError(`Daily rate must be a non-negative number, got ${dailyRate}`);
  }
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(`Days must be a positive integer, got ${days}`);
  }
  const rentalCents = Math.round(dailyRate * 100) * days;
  return Math.round(rentalCents * getInsuranceRate(category)) / 100;
}
