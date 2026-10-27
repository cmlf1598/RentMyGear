/** Smart Insurance: photography and video gear is riskier to rent, so it carries a higher rate. */
export const PHOTOGRAPHY_INSURANCE_RATE = 0.2;
export const DEFAULT_INSURANCE_RATE = 0.1;

/**
 * Accepts the app's category ids ("fotografia-video") as well as plain names in English or
 * Spanish ("photography", "Fotografía y Video"), so the rule doesn't depend on one naming scheme.
 */
function isPhotography(category: string): boolean {
  const normalized = category.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return /photo|fotograf/.test(normalized);
}

export function getInsuranceRate(category: string): number {
  return isPhotography(category) ? PHOTOGRAPHY_INSURANCE_RATE : DEFAULT_INSURANCE_RATE;
}

/** Insurance for the whole rental: rate × daily price × days, rounded to whole cents. */
export function calculateInsurance(category: string, dailyRate: number, days = 1): number {
  if (!Number.isFinite(dailyRate) || dailyRate < 0) {
    throw new RangeError(`Daily rate must be a non-negative number, got ${dailyRate}`);
  }
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(`Days must be a positive integer, got ${days}`);
  }
  const rentalCents = Math.round(dailyRate * 100) * days;
  return Math.round(rentalCents * getInsuranceRate(category)) / 100;
}
