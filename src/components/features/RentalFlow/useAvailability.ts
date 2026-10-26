"use client";

import { useCallback, useEffect, useState } from "react";

import { fromISORanges } from "@/lib/date-utils";
import type { BookedRange, BookedRangeISO } from "@/types/gear";

const POLL_INTERVAL_MS = 30_000;

/**
 * Keeps booked ranges fresh: re-fetches on an interval and whenever the tab
 * regains focus, so the calendar reflects other users' bookings.
 */
export function useAvailability(itemId: string, initial: BookedRangeISO[]) {
  const [booked, setBooked] = useState<BookedRange[]>(() => fromISORanges(initial));
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/availability/${itemId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { bookedRanges: BookedRangeISO[]; checkedAt: string };
      const next = fromISORanges(data.bookedRanges);
      setBooked(next);
      setCheckedAt(new Date(data.checkedAt));
      setError(false);
      return next;
    } catch (cause) {
      console.warn("[useAvailability] refresh failed", { itemId, cause });
      setError(true);
      return null;
    }
  }, [itemId]);

  useEffect(() => {
    const onFocus = () => void refresh();
    const timer = window.setInterval(onFocus, POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { booked, checkedAt, error, refresh };
}
