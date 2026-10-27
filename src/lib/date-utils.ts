import {
  addDays,
  areIntervalsOverlapping,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";

import { calculateInsurance, getInsuranceRate } from "./insurance";
import type { BookedRange, BookedRangeISO, CategoryId } from "../types/gear";

export const SERVICE_FEE_RATE = 0.08;
export const MAX_RENTAL_DAYS = 30;
export const CURRENCY = "USD";
export const LOCALE = "es-US";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** Inclusive day count: picking up and returning the same day is one day. */
export function countRentalDays(from: Date, to: Date): number {
  const diff = differenceInCalendarDays(startOfDay(to), startOfDay(from));
  if (diff < 0) throw new RangeError("Rental end date must not be before the start date");
  return diff + 1;
}

export interface PriceLineItem {
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  days: number;
  dailyRate: number;
  subtotal: number;
  /** Smart Insurance rate for the item's category (0.2 photography, 0.1 otherwise). */
  insuranceRate: number;
  insurance: number;
  serviceFee: number;
  deposit: number;
  /** Amount charged now (subtotal + insurance + fee). The deposit is a refundable hold. */
  total: number;
  lineItems: PriceLineItem[];
}

export interface PricedItem {
  dailyRate: number;
  deposit?: number;
  category: CategoryId;
}

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (cents: number) => cents / 100;
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Computes the rental price in integer cents to avoid floating-point drift. */
export function calculateRentalPrice(
  { dailyRate, deposit = 0, category }: PricedItem,
  from: Date,
  to: Date,
): PriceBreakdown {
  const days = countRentalDays(from, to);
  const subtotalCents = toCents(dailyRate) * days;
  const insuranceCents = toCents(calculateInsurance(dailyRate, days, category));
  const feeCents = Math.round(subtotalCents * SERVICE_FEE_RATE);
  const subtotal = fromCents(subtotalCents);
  const insuranceRate = getInsuranceRate(category);
  const insurance = fromCents(insuranceCents);
  const serviceFee = fromCents(feeCents);

  return {
    days,
    dailyRate,
    subtotal,
    insuranceRate,
    insurance,
    serviceFee,
    deposit,
    total: fromCents(subtotalCents + insuranceCents + feeCents),
    lineItems: [
      { label: `${formatCurrency(dailyRate)} × ${days} ${days === 1 ? "día" : "días"}`, amount: subtotal },
      { label: `Seguro inteligente (${percent(insuranceRate)})`, amount: insurance },
      { label: `Cargo por servicio (${percent(SERVICE_FEE_RATE)})`, amount: serviceFee },
    ],
  };
}

/** Converts relative booked offsets from the mock data into concrete ranges. */
export function resolveBookedRanges(
  offsets: { startInDays: number; lengthDays: number }[],
  now: Date = new Date(),
): BookedRange[] {
  const today = startOfDay(now);
  return offsets.map(({ startInDays, lengthDays }) => {
    const from = addDays(today, startInDays);
    return { from, to: addDays(from, lengthDays - 1) };
  });
}

export function isRangeAvailable(from: Date, to: Date, booked: BookedRange[]): boolean {
  const requested = { start: startOfDay(from), end: startOfDay(to) };
  return !booked.some((range) =>
    areIntervalsOverlapping(requested, { start: startOfDay(range.from), end: startOfDay(range.to) }, {
      inclusive: true,
    }),
  );
}

export function toISORanges(ranges: BookedRange[]): BookedRangeISO[] {
  return ranges.map(({ from, to }) => ({ from: from.toISOString(), to: to.toISOString() }));
}

export function fromISORanges(ranges: BookedRangeISO[]): BookedRange[] {
  return ranges.map(({ from, to }) => ({ from: new Date(from), to: new Date(to) }));
}

export function formatDate(date: Date, pattern = "d 'de' MMMM, yyyy"): string {
  return format(date, pattern, { locale: es });
}

export function formatDateRange(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${formatDate(from, sameYear ? "d 'de' MMM" : "d 'de' MMM, yyyy")} – ${formatDate(to, "d 'de' MMM, yyyy")}`;
}
