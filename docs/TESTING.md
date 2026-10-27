# Testing — Rental module

Vitest + React Testing Library suite for the rental module: price calculation, rental validation, the full
rental flow in the UI, and the Nano Banana image fallback when Unsplash returns a 404.

## Latest results

| | |
|---|---|
| Date | 2026-10-26 |
| Command | `npm test` |
| Result | **57 / 57 tests passed** in 6 files (~6 s) |
| Lint / typecheck | `npm run lint`, `npm run typecheck`: clean |
| Environment | Node 24.18, Windows 11, Vitest 5.0.5, React Testing Library 16.3.3, jsdom 30.1.3 |

| File | Kind | Tests | Result |
|---|---|---:|---|
| `tests/unit/date-utils.test.ts` | Unit | 25 | ✅ all passed |
| `tests/unit/validation.test.ts` | Unit | 10 | ✅ all passed |
| `tests/unit/inventory.test.ts` | Unit (data guard) | 4 | ✅ all passed |
| `tests/integration/rental-flow.test.tsx` | Integration (jsdom) | 7 | ✅ all passed |
| `tests/integration/home-page.test.tsx` | Smoke (jsdom) | 1 | ✅ all passed |
| `tests/edge-cases/unsplash-404-nano-banana.test.ts` | Edge cases | 10 | ✅ all passed |

### Do the tests catch real bugs?

To check, each bug from the `Error Injection` commit (`f9b9e64`) was put back one at a time and the suite was
run against it:

| Bug put back | Tests that failed |
|---|---|
| Off-by-one price (`date-utils.ts`) | **19**: every multi-day price case, plus the end-to-end flow (wrong total) |
| Rentals over 7 days rejected (`validation.ts`) | **3**: "accepts more than a week", "accepts the 30-day maximum", one overlap case |
| "Confirmar" stuck for water sports (`RentalFlow.tsx`) | **4**: every integration test that submits a booking |

The fourth bug, the hydration mismatch in `HeroCarouselClient`, is not covered. It only shows up when React
hydrates server-rendered HTML in a real browser, so catching it needs an E2E test (see [Limitations](#limitations)).

## Running the tests

```bash
npm test             # single run (CI)
npm run test:watch   # watch mode
npx vitest run tests/unit   # one folder
```

## What is tested

### Unit: `src/lib/date-utils.ts`

All dates are local calendar days. Prices use $65/day and the 8% service fee.

| Case | Range | Billed days | Total |
|---|---|---:|---:|
| 1 day (same-day pickup and return) | Jun 10 → Jun 10 | 1 | $70.20 |
| 2 consecutive days | Jun 10 → Jun 11 | 2 | $140.40 |
| 1 week | Jun 1 → Jun 7 | 7 | $491.40 |
| 1 week + 1 day | Jun 1 → Jun 8 | 8 | $561.60 |
| Maximum (30 days) | Jun 1 → Jun 30 | 30 | $2,106.00 |
| Across months (31-day month) | Jan 30 → Feb 2 | 4 | |
| Across months (30-day month) | Apr 29 → May 3 | 5 | |
| February, common year | Feb 27 → Mar 2, 2026 | 4 | |
| February, leap year | Feb 27 → Mar 2, 2028 | 5 | |
| Across years | Dec 30 → Jan 2 | 4 | |
| 30 days over two months | Jun 20 → Jul 19 | 30 | |
| DST spring forward | Mar 7 → Mar 9, 2026 | 3 | |
| DST fall back | Oct 31 → Nov 2, 2026 | 3 | |

Other checks in this file:

- The time of day is ignored.
- Amounts are computed in cents. $19.99 × 3 days gives exactly $64.77, with no floating-point drift.
- The deposit is not part of the total.
- Line items use the Spanish singular/plural ("1 día" / "7 días").
- A return date before the pickup date throws.
- `countRentalDays` matches the price for every length from 1 to 30 days.
- Booking overlap checks are tested at their edges (`isRangeAvailable`).
- Booked offsets are converted to dates correctly (`resolveBookedRanges`).

The suite runs with `TZ=America/New_York`, set in `vitest.config.mts`, so the daylight-saving cases really
cross a UTC-offset change on any machine. Each DST test checks this before testing the price.

### Unit: `src/lib/validation.ts` (the Zod rental schema)

- Accepts same-day, 1-week, 8-day and 30-day rentals.
- Rejects 31 days, with a message that matches the rule.
- Rejects past dates, but allows today.
- Rejects a return date before the pickup date, and ranges that overlap a booking.
- Parses `yyyy-MM-dd` strings as local days.

### Unit: `src/data/inventory.json` (data guard)

- `inventory.json` passes `InventorySchema`.
- Every category id has a config entry and at least one item.
- An item with a category that isn't registered is rejected, and the error names the item (`[3.category]`).
- Duplicate ids are rejected.

This test is the safety net for [adding a category](ONBOARDING.md#8-how-to-add-a-new-category).

### Integration: the full rental flow

The test renders the real `CategoryButtons` → `GearGrid` → `RentalFlow` components inside a small
in-memory router. `fetch` is sent to the **real** route handlers (`GET /api/availability/[id]`,
`POST /api/rentals`), so the server-side validation and price recalculation run as well. "Today" is fixed at
June 3, 2026.

What the test replaces:

- `next/link` and `next/navigation`: there is no Next.js router in jsdom.
- `GearImage`: it is an async Server Component, which Vitest can't render. It has its own tests below.
- The mock booking API's 900 ms delay, which is set to 0.

| Scenario | Expected result | Result |
|---|---|---|
| Happy path: *Deportes Acuáticos* → *Starboard Touring 12'6"* → Jun 10–12 → **Confirmar Renta** | Summary shows "$45.00 × 3 días", total $145.80. One `POST /api/rentals`. **Success toast** with the `RMG-…` code. Confirmed panel shown. | ✅ |
| No dates selected; a single click; the same day clicked again | "Continuar" disabled. One click is a 1-day rental. A second click on the same day clears the selection. | ✅ |
| Range longer than 30 days (Jun 4 → Jul 5) | The calendar restarts the range instead. "Continuar" disabled. No toast. | ✅ |
| Dates booked by someone else before confirming | Error toast "Esas fechas ya no están disponibles". Back to the calendar with the day blocked. **No POST, no success toast.** | ✅ |
| Dates out of date after midnight (server rejects the request with HTTP 422, invalid data) | Error toast "Solicitud inválida", with the inline field error "La fecha de inicio no puede estar en el pasado". **No success toast.** | ✅ |
| Server replies 201 with a malformed body | Error toast, still on the confirm step, button usable again. **No success toast.** | ✅ |
| Network failure | "Error de conexión. Inténtalo de nuevo." Button usable again. **No success toast.** | ✅ |

### Edge cases: Unsplash returns 404 → Nano Banana fallback

Images go through these steps:

1. The seed script searches Unsplash for each item.
2. Items without a photo keep `imageURL: null`.
3. At runtime, `imageService` generates their image with Nano Banana (Gemini 3 Pro Image) and stores it in
   GCS.

The tests cover each step. The Gemini SDK client and the GCS bucket are faked in memory; the Nano Banana
adapter itself is the real code.

| Scenario | Expected result | Result |
|---|---|---|
| Unsplash search returns **404** | Treated as "no photo". One request, no retries. | ✅ |
| …compared with 503 | Retried 3 times, then fails with a clear message. | ✅ |
| …compared with 401 | Stops at once with "check UNSPLASH_ACCESS_KEY". | ✅ |
| Seeding with one 404 and one hit | The 404 item keeps `imageURL: null` and is reported. The other item is still seeded. | ✅ |
| First request for the 404 item | Nano Banana is called with a product prompt. The PNG is stored at `generated/<id>.png` with metadata. Returns `source: "generated"`. | ✅ |
| Later requests, and after a restart | Second request returns `source: "memory"`. A new service instance returns `source: "gcs"`. One generation and one upload in total. | ✅ |
| Three components ask for the image at once | Only one generation runs. | ✅ |
| Item that does have an Unsplash photo | `source: "origin"`. Nano Banana is never called. | ✅ |
| Nano Banana also fails (429 quota) | Spanish message "Se alcanzó el límite de uso de Gemini.", tag "Gemini HTTP 429 · RESOURCE_EXHAUSTED", retry hint "en ~2 min". 30 s cooldown with no new Gemini calls. Recovers after it. | ✅ |
| Gemini safety filter returns no image | "Gemini bloqueó la solicitud por sus filtros.", nothing stored. | ✅ |

## Findings and changes made while testing

1. **An Unsplash 404 stopped the whole seed.** `searchFirstPhoto` treated a 404 like any other error. It
   retried three times and then threw, which ended the script before the remaining items were seeded.
   - Fix: a 404 now counts as "no photo". The item keeps `imageURL: null`, which is what sends it to the Nano
     Banana fallback, and seeding continues.
   - The Unsplash logic moved from `scripts/seed-unsplash-images.ts` into `scripts/unsplash.ts`, so it can be
     tested without network access. The CLI works the same way.
2. **"1 días" in the date picker.** The calendar's range summary always used the plural. It now says
   "1 día", which matches the price summary.

## Limitations

- **The image URL itself returning 404 at runtime is not handled.** This is different from the Unsplash API
  returning 404 during seeding.
  - If a photo is deleted from Unsplash after seeding, the item still has an `imageURL`.
  - `GearImage` renders that URL directly, so the user sees a broken image. Nano Banana isn't used, because the
    fallback only runs when `imageURL` is empty.
  - Fixing this would need a check that the image URL still works, or an error fallback on the client side.
    Either way, it is a design decision and was not part of this change.
- **Async Server Components are not rendered by Vitest.** This affects the pages and `GearImage`; the
  Next.js docs recommend E2E tests for them.
  - The integration test therefore builds its own route table. When a page changes how it passes props to
    `RentalFlow`, update `renderRoute` in the test.
  - The test passes the whole inventory item, so the flow sees every field it could receive.
- **Hydration mismatches** only appear in a real browser. A Playwright test that loads `/` and checks the
  console would cover the class of bug planted in `HeroCarouselClient`.

## Test setup

- `vitest.config.mts`:
  - Uses Vite 8's built-in `resolve.tsconfigPaths`, so the `@/` imports resolve.
  - Replaces `server-only` with an empty module (`tests/stubs/server-only.ts`), because the real package throws
    outside a server bundle.
  - Defaults to the `node` environment. The integration test switches to jsdom with a
    `// @vitest-environment jsdom` comment.
- `@vitejs/plugin-react` and `vite-tsconfig-paths` are not installed.
  - The plugin's optional Babel 8 peer dependency conflicts with shadcn's Babel 7.
  - Vitest compiles JSX using the project's `jsx: react-jsx` setting, so the plugin isn't needed.
  - Vite 8 resolves tsconfig paths itself, so `vite-tsconfig-paths` isn't needed either.
- `@types/node` was raised from `^20` to `^24` to match the Node runtime. Vitest 5 requires 22 or newer.
- Sonner keeps toasts in module state and replays any that are still active to a newly mounted `<Toaster>`.
  The integration tests call `toast.dismiss()` before each test so no toasts carry over.
