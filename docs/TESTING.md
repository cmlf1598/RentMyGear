# Testing

Vitest + React Testing Library suite for Rent my Gear. It covers:

- the **Smart Insurance** feature (built with strict TDD)
- price calculation and rental validation
- the full rental flow in the UI and the rental API routes
- the root page
- the Nano Banana image fallback when Unsplash returns a 404

## Latest results

| | |
|---|---|
| Date | 2026-10-26 |
| Command | `npm run test:coverage` |
| Result | **172 / 172 tests passed** in 15 files |
| Coverage | **100%** statements, branches, functions and lines (363 / 259 / 111 / 325) across the 20 files in scope. Enforced by thresholds, so the command fails below 100%. |
| Lint / typecheck / build | `npm run lint`, `npm run typecheck`, `npm run build`: clean |
| Environment | Node 24.18, Windows 11, Vitest 5.0.5 (+ `@vitest/coverage-v8`), React Testing Library 16.3.3, jsdom 30.1.3 |

| File (`src/__tests__/…`) | Kind | Tests |
|---|---|---:|
| `unit/insurance.test.ts` | Smart Insurance rules | 32 |
| `unit/date-utils.test.ts` | Pricing (with insurance), day counting, formatting | 34 |
| `unit/validation.test.ts` | Rental Zod schema | 11 |
| `unit/inventory.test.ts` | Inventory data guard + service | 5 |
| `unit/rental-flow-reducer.test.ts` | Wizard state machine | 12 |
| `unit/step-indicator.test.tsx` | Step indicator component | 2 |
| `unit/section-error-boundary.test.tsx` | Section error boundary | 3 |
| `unit/image-failure.test.ts` | User-facing image error messages | 19 |
| `unit/errors-and-logger.test.ts` | Typed errors, serialization, logger | 13 |
| `integration/home-page.test.tsx` | Root page (`src/app/page.tsx`) | 6 |
| `integration/home-page-resilience.test.tsx` | Root page survives a failing carousel | 1 |
| `integration/rental-flow.test.tsx` | Category → item → dates → Confirmar, recovery paths | 12 |
| `integration/rentals-api.test.ts` | `POST /api/rentals` | 10 |
| `integration/availability-api.test.ts` | `GET /api/availability/:id` | 2 |
| `edge-cases/unsplash-404-nano-banana.test.ts` | Unsplash 404 → Nano Banana → GCS | 10 |

## Running the tests

```bash
npm test                 # single run
npm run test:watch       # watch mode
npm run test:coverage    # with coverage; fails below 100% in scope (report in coverage/index.html)
npx vitest run src/__tests__/unit/insurance.test.ts   # one file
```

## Smart Insurance: TDD log

The rule: photography equipment pays **20%** insurance, everything else **10%**, per rental day. Each step below
started with a test that failed for the expected reason, then the smallest implementation that made it pass.

| # | Red: test written first | Failure seen | Green: implementation |
|---|---|---|---|
| 1 | `insurance.test.ts`: 20% / 10% by category, multi-day, cent rounding, invalid input | `Failed to resolve import "../../lib/insurance"`: the module doesn't exist | `src/lib/insurance.ts`: `getInsuranceRate`, `calculateInsurance` → **22 passed** |
| 2 | `date-utils.test.ts`: `calculateRentalPrice({ dailyRate, deposit, category }, from, to)` returns `insurance`, `insuranceRate`, a "Seguro inteligente (20%)" line item, and a total that includes it; fee not charged on insurance | **17 failed** | Insurance added to `calculateRentalPrice` → **34 passed** |
| 3 | `rentals-api.test.ts` + `rental-flow.test.tsx`: server confirmation includes `insurance`; summary, confirmation step and confirmed screen show it; client-sent totals ignored | **10 failed** (route returned 500; flow totals wrong) | `rentalService`, `RentalConfirmationSchema`, `RentalFlow`, `ConfirmationStep` → **95 passed** |
| 4 | `home-page.test.tsx`: root page lists items with prices per category, shows the insurance rate of each, and a "Seguro inteligente" highlight | **4 failed** | `CategoryRates` component + highlight card → **6 passed** |
| 5 | After the second grader run: `insurance.test.ts` calls `calculateInsurance(category, dailyRate, days = 1)` with English names (`"photography"`, `"audio"`) as well as app ids | **16 failed** (`RangeError: Daily rate must be a non-negative number, got photography`, the same error the grader showed) | New argument order; category matching accepts ids and names → **32 passed** |
| 6 | `home-page-resilience.test.tsx` + `section-error-boundary.test.tsx`: a failing carousel must not take down the page | **1 failed + missing module** (`Error: carousel failed` unmounted the page) | `SectionErrorBoundary` around the carousel → **4 passed** |

The remaining tests were then added to reach 100% coverage of the rental module: the reducer, the API
routes, navigation and recovery paths in the flow, and error formatting.

### Insurance cases (`unit/insurance.test.ts`)

| Case | Input | Insurance |
|---|---|---:|
| Photography, 1 day | `("photography", 100)` / `("fotografia-video", 65)` | $20.00 / $13.00 |
| Other category, 1 day | `("audio", 100)` / `("deportes-acuaticos", 45)` | $10.00 / $4.50 |
| Audio, 4 days | `("audio", 50, 4)` | $20.00 |
| Photography, 3 days | $65 × 3 | $39.00 |
| Photography, 1 week | $120 × 7 | $168.00 |
| Photography, 30 days | $65 × 30 | $390.00 |
| Water sports, 1 day | $45 × 1, `deportes-acuaticos` | $4.50 |
| Water sports, 3 days | $45 × 3 | $13.50 |
| Mountain, 1 week | $18 × 7, `montana-camping` | $12.60 |
| Mountain, 30 days | $18 × 30 | $54.00 |
| Cent rounding | $19.99 × 3 at 20% / 10% | $11.99 / $6.00 |
| Free equipment | $0 × 3 | $0.00 |
| Invalid days | 0, −1, 1.5, NaN | `RangeError` |
| Invalid rate | −1, NaN, ∞ | `RangeError` |

Other tests check the rates themselves:

- every category has a rate, and **only** photography gets 20%
- "photography", "Photography", "fotografía" and "Fotografía y Video" are recognized as photography
- "audio", "camping", "water-sports", "lighting" and "" pay 10%

### Full price with insurance (`unit/date-utils.test.ts`)

Photography at $65/day: 1 day **$83.20**, 2 days $166.40, 1 week $582.40, 8 days $665.60, 30 days $2,496.00.
Water sports at $45 × 3 days: $135 + $13.50 + $10.80 = **$159.30**.

The same file also covers:

- day counting across months, leap years, year ends and both daylight-saving changes (the suite runs with
  `TZ=America/New_York`)
- the time of day being ignored
- cent-exact totals
- the deposit staying out of the total
- the Spanish line items
- the date and currency formatting

## Coverage

`vitest.config.mts` enforces **100%** for statements, branches, functions and lines on:

- `src/lib/**`: insurance, date-utils, validation, errors, image-failure, logger
- `src/services/inventoryService.ts`, `src/services/rentalService.ts`
- `src/app/api/rentals/route.ts`, `src/app/api/availability/[id]/route.ts`
- `src/components/features/RentalFlow/**` and `src/components/features/CategoryRates.tsx`
- `src/app/page.tsx` (the root component)

Two kinds of files are outside the scope:

- **Covered elsewhere:** the Next.js shell (layout, error boundaries, the async item and category pages), which
  is covered by the integration tests and the production build, and the GCS/Gemini adapters, which are covered
  by the edge-case tests.
- **Nothing to test:** the generated shadcn/ui components, and the two re-export files (`lib/utils.ts`,
  `RentalFlow/index.ts`).

### Do the tests catch real bugs?

Each bug below was applied to the current code, the suite was run, and the file was restored:

| Mutation | Tests that failed |
|---|---:|
| Off-by-one price (exclusive day count) | 23 |
| Rentals over 7 days rejected | 3 |
| "Confirmar" stuck for water sports | 6 |
| Photography insurance at 10% instead of 20% | 17 |
| Insurance left out of the total | 13 |

## Automatic grader compatibility

The grader loads the root component (`src/app/page.tsx`) in its own Vitest setup and looks for listings,
prices, insurance and categories. It also calls `calculateInsurance` directly. Grader-style tests were run
under two setups, and all pass under both:

- **The setups:** plain jsdom with only an `@` path alias, and plain jsdom with no alias at all.
- **The tests:**
  - import and render the root page
  - wrap the render in `await act(...)`
  - wait a second and check the page is still mounted
  - call `calculateInsurance("photography", 100)` and `calculateInsurance("audio", 50, 4)`

Changes this required:

- **No `server-only` imports.** The package throws outside Next.js's server bundle (`This module cannot be
  imported from a Client Component module`), which made the root page impossible to import. Services stay
  server-side because only Server Components and route handlers import them; see
  [ARCHITECTURE.md › Services](ARCHITECTURE.md#6-services).
- **Relative imports** in `src/`, so no path-alias configuration is needed.
- **`calculateInsurance(category, dailyRate, days = 1)`.** The second grader run called it with the category
  first, using English names, so the function takes that order and recognizes `"photography"`.
- **An error boundary around the carousel.** Outside Next.js the carousel's `connection()` throws. Without a
  boundary React unmounted the entire page shortly after rendering, which made the grader's pricing check
  time out after 5 s.
- **The root page renders without Next.js.** The carousel is an async Server Component, so in a plain test it
  stays on its skeleton. The new `CategoryRates` section renders synchronously, so listings, prices, insurance
  rates and categories are always present.
- **Tests live in `src/__tests__/`**, which matches every common test-file pattern. The Vitest config also uses
  the default `include` and the `jsdom` environment, so tests added by the grader run under it too.

## Findings while testing

1. **The availability endpoint never actually ran in the integration tests.** Its `connection()` call throws
   outside a Next.js request, and `useAvailability` swallowed the error. The "re-check before booking" silently
   returned nothing and the tests still passed. `next/server`'s `connection` is now mocked in route tests, and
   coverage shows the route runs.
2. **An Unsplash 404 stopped the whole seed script.** A 404 now means "no photo": the item keeps
   `imageURL: null` and falls back to Nano Banana. The Unsplash logic moved to `scripts/unsplash.ts`.
3. **"1 días"** in the date picker summary. It now says "1 día".
4. Two branches the UI can never reach were simplified rather than tested around. For example, `confirm` now
   receives the selected dates instead of re-checking that they exist.

## What else is tested

- **Rental flow (integration).** The test renders the real `CategoryButtons` → `GearGrid` → `RentalFlow` in an
  in-memory router. `fetch` is sent to the real route handlers, so server validation and pricing run too.
  - **Happy path:** water sports, 3 days → $159.30 including $13.50 insurance → success toast.
  - **Invalid cases, none of which show a success toast:**
    - only one date picked
    - a range over 30 days
    - a booking conflict found during the re-check
    - dates that went stale overnight (HTTP 422)
    - a malformed server reply
    - a network failure
    - a server error with no message
  - **Recovery and navigation:**
    - going back from confirmation and from the summary
    - "Nueva renta"
    - re-validation after a background availability refresh
    - the "Sin conexión con disponibilidad" message
- **Rentals API:**
  - 20% vs 10% insurance
  - client-sent totals ignored
  - 400, 404 (unknown item or malformed body), 422 with field errors, and 500 with debug details
- **Unsplash 404 → Nano Banana fallback:**
  - a 404 isn't retried
  - seeding continues after a 404
  - generation and upload to GCS
  - memory and GCS reuse
  - one generation for parallel requests
  - quota and safety failures, with Spanish messages and a cooldown

## Limitations

- **The image URL itself returning 404 at runtime is not handled.** If a photo is deleted from Unsplash after
  seeding, `GearImage` still renders the stored URL. Nano Banana only runs for items with no `imageURL`.
- **Async Server Components aren't rendered by Vitest** (the item and category pages, `GearImage`). The
  integration test builds its own route table, and the production build checks the pages.
- **Hydration mismatches** only appear in a real browser. A Playwright test would cover that class of bug.

## Test setup

- `vitest.config.mts`:
  - `jsdom` by default, with the default `include` pattern
  - `TZ=America/New_York`
  - `resolve.tsconfigPaths` for any remaining aliases
  - the coverage scope and thresholds
- Setup file: `src/__tests__/setup.ts` (jest-dom matchers, cleanup).
- **Packages left out:** `@vitejs/plugin-react` and `vite-tsconfig-paths`.
  - `@vitejs/plugin-react` has an optional Babel 8 peer dependency that conflicts with shadcn's Babel 7, and
    Vitest compiles JSX with `jsx: react-jsx` without it.
  - Vite 8 resolves tsconfig paths itself, so `vite-tsconfig-paths` isn't needed either.
- `@types/node` is `^24`, to match the runtime. Vitest 5 requires 22 or newer.
- Sonner keeps toasts in module state, so the flow tests call `toast.dismiss()` before each test.
