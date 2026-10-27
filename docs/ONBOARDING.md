# Onboarding Guide

Welcome to Rent my Gear. This guide gets you from a fresh clone to making changes with confidence: setting up
your machine, finding your way around the code, following the conventions, and debugging. It also covers two
tasks in detail: **debugging the GCS connection** and **adding a new category**.

Suggested reading order:

1. This guide
2. [ARCHITECTURE.md](ARCHITECTURE.md): rendering, services, the image flow and the rental flow, with diagrams
3. [API.md](API.md): the HTTP endpoints, including the debugging ones
4. [TESTING.md](TESTING.md): the test suite and what it covers

## Contents

1. [Prerequisites](#1-prerequisites)
2. [First-time setup](#2-first-time-setup)
3. [Everyday commands](#3-everyday-commands)
4. [A guided tour of the code](#4-a-guided-tour-of-the-code)
5. [Conventions](#5-conventions)
6. [Debugging toolbox](#6-debugging-toolbox)
7. [How to debug the GCS connection](#7-how-to-debug-the-gcs-connection)
8. [How to add a new category](#8-how-to-add-a-new-category)
9. [Troubleshooting](#9-troubleshooting)
10. [Before you open a pull request](#10-before-you-open-a-pull-request)

## 1. Prerequisites

| You need | Why | Link |
|---|---|---|
| **Node.js 24** and npm | Runs the app, the scripts and the tests. The project is developed on 24.18. | <https://nodejs.org> |
| **uv** (Python ≥ 3.10) | Runs `setup_gcs.py`, which declares its own dependencies inline (PEP 723). | <https://docs.astral.sh/uv/getting-started/installation/> |
| A **Google Cloud project with billing enabled** | Hosts the GCS bucket for AI-generated images. | <https://console.cloud.google.com/projectcreate> |
| A **Gemini API key with billing or prepaid credits** | Nano Banana Pro has **no free tier**: on the free tier it returns `429 … limit: 0`. | <https://aistudio.google.com/apikey> |
| An Unsplash access key *(optional)* | Only for re-running the image seed script. The repo already has the seeded URLs. | <https://unsplash.com/oauth/applications> |

On Windows, the default shell is PowerShell 5.1, which has no `&&` (use `;`), and `curl` there is an alias.
Use `curl.exe`, or use Git Bash.

## 2. First-time setup

### 2.1 Install

```bash
git clone <repo-url> rent-my-gear
cd rent-my-gear
npm install
cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local
```

### 2.2 Get the Google Cloud values

You need three values for `.env.local`.

1. **`GCS_PROJECT_ID`**
   - Open the [Cloud console](https://console.cloud.google.com/) and pick your project in the project picker.
   - Copy the **ID** column, not the project name or number. It looks like `rent-my-gear-512822`.
2. **The service account and its key**
   - Go to [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) and
     click *Create service account*.
   - Grant it **Storage Admin** (`roles/storage.admin`). The setup script needs it to create the bucket and
     make it public.
   - At runtime the app only needs **Storage Object Admin** on the bucket. Use a narrower account in shared
     environments.
   - Open the account, go to *Keys → Add key → Create new key → JSON*, and save the file in `./credentials/`,
     which git ignores.
3. **`GOOGLE_APPLICATION_CREDENTIALS`**: the path to that file. It can be relative to the project root, for
   example `./credentials/rent-my-gear-512822-abc123.json`.
4. **`GCS_BUCKET_NAME`**: a globally unique name, 3–63 characters, lowercase, for example
   `rent-my-gear-<you>-2026`. The setup script creates the bucket.

Then set **`NANO_BANANA_API_KEY`** to your Gemini key. All the variables are listed in
[ARCHITECTURE.md › Configuration](ARCHITECTURE.md#11-configuration).

### 2.3 Create and check the bucket

```bash
npm run setup:gcs          # = uv run setup_gcs.py
```

The script runs these steps and prints ✅ or ❌ for each, with a hint on every failure:

1. Load the config.
2. Authenticate.
3. Create the bucket, with uniform access, if it doesn't exist.
4. Allow public read (`allUsers` → `roles/storage.objectViewer`).
5. Set CORS.
6. Run a **smoke test**: upload a file, read it back through its public URL, delete it.

It is safe to run again.

### 2.4 Run the app

```bash
npm run dev
```

1. **Watch the terminal.** The server checks every environment variable before it accepts requests. If any are
   wrong, it prints a report and exits; see [Troubleshooting](#9-troubleshooting). A good start logs
   `[INFO ] [app:startup] Environment validated { bucket, project, imageModel }`.
2. **Open <http://localhost:3000/api/health>.** You should see `"status": "ok"` and `"storage": { "ok": true }`.
3. **Open <http://localhost:3000>** and browse a category. Items without a photo show *"Generando imagen con
   IA…"* and stream in about 10–20 s later. Each is generated **once**; after that it is served from GCS.

## 3. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack). **Only one** `next dev` can run per project folder. |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (`eslint-config-next`, including the React hooks/compiler rules) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` / `npm run test:watch` | Vitest: unit, integration and edge-case tests |
| `npm run test:coverage` | Tests plus coverage. **Fails below 100%** for the rental module and Smart Insurance (scope in `vitest.config.mts`). HTML report in `coverage/`. |
| `npm run setup:gcs` | Create or check the bucket. `-- --smoke-only` only runs the permission test. |
| `npm run seed:images` | Fill `imageURL` from Unsplash for items that have none. Add `-- --dry-run` to preview, or `-- --force` to re-seed every item. |

## 4. A guided tour of the code

The quickest way to learn the codebase is to follow three requests through it.

### 4.1 Loading the home page (`/`)

1. [`src/app/layout.tsx`](../src/app/layout.tsx) renders the header, footer and toaster. The header and footer
   build their category links from `CATEGORY_LIST`.
2. [`src/app/page.tsx`](../src/app/page.tsx) renders the static hero copy,
   [`CategoryButtons`](../src/components/features/CategoryButtons.tsx) (which reads
   `inventoryService.countByCategory()`), and a `<Suspense>` around `HeroCarousel`.
3. [`HeroCarousel`](../src/components/features/HeroCarousel.tsx) calls `await connection()` (so the result is
   computed per request) and picks 5 random items. It then renders each slide's `GearImage` on the server and
   passes the slides to [`HeroCarouselClient`](../src/components/features/HeroCarouselClient.tsx), which only
   handles autoplay and the dot buttons.

### 4.2 Showing an item that has no image

1. [`GearImage`](../src/components/features/GearImage/GearImage.tsx) sees `imageURL === null`. It renders a
   `<Suspense>` placeholder and `ResolvedGearImage`.
2. `ResolvedGearImage` calls `getImageService().resolveImageUrl(item)` in
   [`imageService.ts`](../src/services/imageService.ts). The service checks its memory cache, then GCS
   ([`storageService.ts`](../src/services/storageService.ts)), then calls Nano Banana (the
   `createNanoBananaGenerator` adapter) and uploads the result.
3. If that fails, [`describeImageFailure`](../src/lib/image-failure.ts) turns the error into a Spanish reason
   and a technical tag, and the server renders "Imagen no disponible".

The sequence diagram in [ARCHITECTURE.md](ARCHITECTURE.md#7-image-resolution-flow) shows every branch.

### 4.3 Booking an item

1. [`src/app/gear/[id]/page.tsx`](../src/app/gear/[id]/page.tsx) streams `RentalPanel`. It calls
   `connection()`, reads the booked ranges and renders [`RentalFlow`](../src/components/features/RentalFlow/RentalFlow.tsx).
2. `RentalFlow` is a reducer-driven wizard ([`rentalFlowReducer.ts`](../src/components/features/RentalFlow/rentalFlowReducer.ts)).
   Its steps are `DateSelectionStep` → `PriceSummaryStep` → `ConfirmationStep`.
   - Prices come from [`calculateRentalPrice`](../src/lib/date-utils.ts), which adds Smart Insurance from
     [`insurance.ts`](../src/lib/insurance.ts): 20% for photography and video, 10% for everything else.
   - Validation uses [`createRentalRequestSchema`](../src/lib/validation.ts).
3. Confirming the booking re-checks availability (`useAvailability.refresh()`), then calls `POST /api/rentals`
   ([route](../src/app/api/rentals/route.ts) → [`rentalService`](../src/services/rentalService.ts)). The server
   validates again with the same schema and recalculates the price.

## 5. Conventions

- **Language.** The UI text is Spanish (`lang="es"`). Code, identifiers, comments, logs and docs are English.
- **Where code goes:**
  - routes → `src/app`
  - domain UI → `src/components/features`
  - shadcn components → `src/components/ui` (generated with `npx shadcn add`; keep local edits small)
  - pure logic → `src/lib`
  - I/O and business rules → `src/services`
  - Zod schemas and types → `src/types`
  - static configuration → `src/config`
- **Services** are created with a factory, `createXService(deps)`, and use one default instance. Pass fakes
  through the factory in tests instead of mocking modules. Don't add `import "server-only"`: it breaks loading
  the root page in plain Vitest, which the automatic grader does. See [Services](ARCHITECTURE.md#6-services).
- **Server Components first.** Add `"use client"` only for state, effects or browser APIs. Put anything
  request-dependent behind `await connection()`, inside a `<Suspense>` boundary (see
  [Rendering model](ARCHITECTURE.md#4-rendering-model)).
- **No randomness, clock or locale in a client component's first render.** Compute those values on the server
  and pass them in. The HeroCarousel hydration bug was caused by breaking this rule.
- **Validate at the edges with Zod:** environment, inventory data, request bodies and API responses. Derive
  types with `z.infer` instead of writing them twice.
- **Errors** are `AppError` subclasses with a stable `code` and a useful `cause`. Never throw bare strings.
  Turn expected failures into UI on the server, because production builds hide error-boundary messages.
- **Logging** goes through `logger.child("scope")`, with a short message and a context object. Don't use
  `console.log` in server code.
- **Dates and money:**
  - Dates are local calendar days, and travel as `yyyy-MM-dd` strings (`toDateOnly`).
  - Day counts are inclusive (`countRentalDays`).
  - Amounts are calculated in integer cents and formatted with `formatCurrency` (USD, `es-US`).
- **Imports** inside `src/` are relative (`../lib/insurance`), not `@/…`, so any test runner can resolve them
  without path-alias config. `npx shadcn add` still generates `@/` imports; convert them to relative paths.
- **Comments** explain *why*, not what.
- **Tests** go in `src/__tests__/{unit,integration,edge-cases}` (see [TESTING.md](TESTING.md)). Write the test
  first and watch it fail, then implement. Smart Insurance was built that way.

## 6. Debugging toolbox

| Tool | Use it for |
|---|---|
| **Terminal output** of `npm run dev` | Server logs: `[LEVEL] [app:scope] message {context}`. Set `LOG_LEVEL=debug` in `.env.local` to see every GCS call with its timing. |
| `.next/dev/logs/` | Next.js's own dev-server log files |
| **Browser console** | Errors caught by boundaries are logged as `[ErrorBoundary:<name>]` (`root`, `category`, `gear`, `image`). `RentalFlow` logs `[RentalFlow] rental rejected` and `[RentalFlow] rental request failed`. |
| `GET /api/health` | Config, inventory counts, items without images, a live GCS check |
| `GET /api/images/<id>` | Where an item's image comes from (`origin`, `memory`, `gcs`, `generated`), or why it fails. Add `?fresh` to skip the cache and the cooldowns. |
| React DevTools | Inspect `RentalFlow` state (step, range, `submitting`, errors) |
| `npm test -- -t "<name>"` | Run one test by name while you investigate |

## 7. How to debug the GCS connection

Images generated by AI are written to and listed from GCS. The UI shows a broken GCS connection as **"Imagen no
disponible · No se pudo acceder a Cloud Storage."**, with the tag `Cloud Storage`. Go through these steps in
order; each one narrows down the cause.

### Step 1: Does the server start?

The environment check runs before anything else. Read the report it prints:

```text
Invalid server environment configuration.
  ✖ GOOGLE_APPLICATION_CREDENTIALS: File does not exist: C:\...\credentials\service-account.json
      ↳ Absolute or project-relative path to a service-account JSON key with Storage Object Admin on the bucket.
```

- *"File does not exist"*: fix the path. Relative paths start from the project root.
- *"File is not a service-account key (invalid fields: …)"*: you downloaded the wrong kind of file, for
  example an OAuth client. Create a **service-account** key instead.
- *"must be 6-30 chars…"* on `GCS_PROJECT_ID`: you entered the project name or number instead of its ID.

### Step 2: Check the credentials, independently of the app

```bash
npm run setup:gcs -- --smoke-only
```

This checks four things: authentication, upload, reading back through the public URL, and delete. Each ❌ comes
with a hint:

| ❌ message | Meaning / fix |
|---|---|
| `Could not load service-account key` | The key file is corrupt, or not a service-account key. |
| `Permission denied while looking up the bucket` | Grant the service account **Storage Admin**, or at least Storage Object Admin on the bucket. |
| `Bucket name is already taken by another project` | Bucket names are global. Pick a different `GCS_BUCKET_NAME`. |
| `Upload denied` / `Delete denied` | The account is missing `storage.objects.create` or `storage.objects.delete`: grant **Storage Object Admin**. |
| `Public URL returned HTTP 403` | `allUsers` is missing `roles/storage.objectViewer`. Run the full `npm run setup:gcs`, or wait a minute for the permission to take effect. |
| `Public access is blocked by policy` | Your organization enforces `storage.publicAccessPrevention`. Ask an org admin for an exemption, or use a project outside the organization. |

### Step 3: Ask the running app

```bash
curl http://localhost:3000/api/health
```

- `"storage": { "ok": true }`: the app can list the bucket. Go to step 4.
- `503` with `"status": "degraded"`: read `storage.error.cause.message`. It is the raw GCS error:

| `cause.message` contains… | Fix |
|---|---|
| `does not have storage.objects.list access` | Grant the runtime service account **Storage Object Admin** on the bucket. |
| `The specified bucket does not exist` | Wrong `GCS_BUCKET_NAME`, or the bucket is in another project. Run `npm run setup:gcs`. |
| `invalid_grant` / `Invalid JWT Signature` | The key was deleted or rotated, or the system clock is wrong. Create a new key, or sync the clock. |
| `getaddrinfo` / `ETIMEDOUT` | Network, proxy or firewall problem reaching `storage.googleapis.com`. |

### Step 4: Follow a single image

```bash
curl "http://localhost:3000/api/images/blackmagic-pocket-6k-pro?fresh"
```

- `"source": "gcs"`: GCS reads work, and the object `generated/<id>.*` exists.
- `"source": "generated"`: the object was missing. It was just created and uploaded, so writes work too.
- **502**: compare `failure.technical`. If it is `Cloud Storage`, it's GCS; if it is `Gemini HTTP …`, it's
  Gemini. The full chain is in `error.cause`.

With `LOG_LEVEL=debug`, the terminal shows each call:

```text
[DEBUG] [app:storageService] findByPrefix ok { path: 'generated/blackmagic-pocket-6k-pro.', ms: 212 }
[INFO ] [app:imageService] Reusing persisted AI image { itemId: 'blackmagic-pocket-6k-pro', url: '…' }
```

A failure is logged as `[ERROR] [app:imageService] Image resolution failed { itemId, error }`, where the
serialized `StorageError` names the operation, path and bucket.

### Step 5: Check what the browser receives

- **The public object itself:** `curl -I https://storage.googleapis.com/<bucket>/generated/<id>.jpg` should
  return `200` with `cache-control: public, max-age=31536000, immutable`.
- **List what has been generated** (works because the bucket is public):
  `https://storage.googleapis.com/storage/v1/b/<bucket>/o?prefix=generated/`
- **`/_next/image?url=…` returns 400 with `"url" parameter is not allowed`:** the image host or bucket is
  not in `images.remotePatterns`. `next.config.ts` reads `GCS_BUCKET_NAME` when the server starts, so
  **restart `npm run dev` after changing the bucket**.

### Step 6: After fixing it

An item that failed is not retried for **30 s**. Wait, or call `/api/images/<id>?fresh` to clear the cooldown
and the cache, then reload the page.

## 8. How to add a new category

Categories are defined in **one Zod enum**. TypeScript and the inventory schema use it to catch every place that
needs updating. Follow the steps in order: TypeScript will point at the remaining places, and the test suite
checks the data.

### What validates categories (and what doesn't)

| Schema / type | Where | Role |
|---|---|---|
| `CATEGORY_IDS` → `CategoryIdSchema` (`z.enum`) → `CategoryId` | `src/types/gear.ts` | **The single source of truth.** Every other place derives from it. |
| `GearItemSchema.category` → `InventorySchema` | `src/types/gear.ts` | Rejects any item whose `category` isn't in the enum when the inventory loads. |
| `Record<CategoryId, …>` types | `categories.ts`, `CategoryButtons.tsx`, `inventoryService.ts` | **Won't compile** until the new id has an entry. |
| Rental schema, env schema | `validation.ts`, `env.ts` | Category-agnostic; **no change needed**. |

### Rules that keep existing data valid

- **Add a new id; never rename or remove an existing one.** Renaming makes every item that uses the old id
  fail `InventorySchema`, and breaks existing `/category/<id>` URLs.
- The id appears in URLs, so make it a lowercase ASCII slug with no accents: `ciclismo`, not `Ciclismo` or
  `ciclísmo`.
- Ship the category **together with at least one item**. A category with no items is valid code, but shows an
  empty grid, and `src/__tests__/unit/inventory.test.ts` fails on purpose.

### Step by step (example: `ciclismo`)

**1. Add the id to the enum**: [`src/types/gear.ts`](../src/types/gear.ts)

```ts
export const CATEGORY_IDS = ["fotografia-video", "montana-camping", "deportes-acuaticos", "ciclismo"] as const;
```

**2. Run `npm run typecheck`.** It reports exactly these three places, verified against this codebase:

```text
src/components/features/CategoryButtons.tsx  TS2741: Property 'ciclismo' is missing in type … Record<…>
src/config/categories.ts                     TS2741: Property 'ciclismo' is missing in type … Record<…, Category>
src/services/inventoryService.ts             TS2322 / TS7053: countByCategory() … Property 'ciclismo' is missing
```

**3. Add the config entry**: [`src/config/categories.ts`](../src/config/categories.ts)

```ts
ciclismo: {
  id: "ciclismo",
  name: "Ciclismo",
  tagline: "Bicicletas de ruta, montaña y gravel",
  description: "Bicicletas premium y accesorios para rodadas, viajes y competencias.",
  imagePromptContext: "premium cycling equipment and bicycles",
},
```

The UI copy is Spanish. `imagePromptContext` is English and steers the style of Nano Banana's images for this
category.

**Smart Insurance:** the new category is charged **10%** automatically (`getInsuranceRate` in
[`src/lib/insurance.ts`](../src/lib/insurance.ts)). If it should be 20%, like photography, add a failing case to
`src/__tests__/unit/insurance.test.ts` first, then change `getInsuranceRate`. The test "only photography gets 20%"
exists to make that decision deliberate.

**4. Give the tile its style**: [`src/components/features/CategoryButtons.tsx`](../src/components/features/CategoryButtons.tsx)

```ts
import { Bike /* … */ } from "lucide-react";

ciclismo: {
  icon: Bike,
  tile: "from-violet-50 via-fuchsia-50 to-pink-100 hover:shadow-violet-200/60",
  iconWrap: "bg-violet-500/10 text-violet-600",
},
```

The grid uses `md:grid-cols-3`, so a fourth tile wraps onto a new row. Change it to `md:grid-cols-2
lg:grid-cols-4` if you want the tiles on one line.

**5. Add the counter**: [`src/services/inventoryService.ts`](../src/services/inventoryService.ts),
`countByCategory`

```ts
const counts = { "fotografia-video": 0, "montana-camping": 0, "deportes-acuaticos": 0, ciclismo: 0 };
```

**6. Add items**: [`src/data/inventory.json`](../src/data/inventory.json)

- Use `"category": "ciclismo"` and a unique lowercase `id`. Fill in every `GearItem` field; see
  [Domain model](ARCHITECTURE.md#5-domain-model).
- Use `"imageURL": null` to let Nano Banana generate the photo, or run `npm run seed:images` to look for an
  Unsplash photo.
- `bookedOffsets` are relative to today, for example `[{ "startInDays": 3, "lengthDays": 2 }]`.

**7. Verify**

```bash
npm run typecheck && npm run lint && npm test
```

- Visit `/api/health` and check that `inventory.byCategory.ciclismo` is greater than 0.
- Visit `/category/ciclismo`. The header nav, footer and `generateStaticParams` pick up the new category
  automatically from `CATEGORY_LIST`, and items without photos start generating.

### What a mistake looks like

If an item uses a category that isn't in the enum, for example a typo or a missing step 1, loading the
inventory fails with a message that points at that item:

```text
InventoryValidationError: Inventory data is invalid:
  - [3.category] Invalid option: expected one of "fotografia-video"|"montana-camping"|"deportes-acuaticos"
```

`src/__tests__/unit/inventory.test.ts` catches this before you start the server. It also checks that every category
has a config entry and at least one item.

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npm run dev` prints *"Invalid server environment configuration"* and exits | A missing or invalid variable | Follow the ✖ lines and their ↳ hints. See [GCS step 1](#step-1-does-the-server-start). |
| A second `npm run dev` refuses to start | Next.js 16 allows only one dev server per project folder | Stop the other one, or use it. |
| The page reloads over and over in dev (`[Fast Refresh] rebuilding` → full reload) | Stale dev cache, for example after switching git branches | Stop the server, delete `.next/dev`, start again. |
| "Imagen no disponible · Se alcanzó el límite de uso de Gemini." (`HTTP 429`) | No billing on the Gemini key (the free tier limit is 0 for this model), or the quota is used up | Enable billing; retry after the time shown. |
| "Los créditos de Gemini están agotados." (`HTTP 402`) | Prepaid credits are used up | Add credits in AI Studio. |
| "La API key de Gemini no es válida." (`HTTP 400`) | Wrong or revoked `NANO_BANANA_API_KEY` | Create a new key and restart. |
| "No se pudo acceder a Cloud Storage." | GCS connection problem | [Section 7](#7-how-to-debug-the-gcs-connection) |
| An Unsplash photo is broken | The photo was deleted on Unsplash after seeding (known limitation) | Set that item's `imageURL` to `null` so Nano Banana generates one, or re-seed it. |
| A hydration warning in the browser console | A client component rendered something different on the server and in the browser | Look for `Math.random`, `Date`, `toLocale*` or `typeof window` in a first render. See [Conventions](#5-conventions). |
| `curl` behaves oddly in PowerShell | It's an alias for `Invoke-WebRequest` | Use `curl.exe`. |

## 10. Before you open a pull request

- [ ] `npm run lint`, `npm run typecheck` and `npm run test:coverage` all pass (coverage stays at 100%).
- [ ] New logic has tests in `src/__tests__/`, written first (unit for pure functions, integration for UI flows).
- [ ] Anything request-dependent is behind `connection()` and inside `<Suspense>`. A client component's first
      render doesn't use randomness or the current time.
- [ ] New inputs are validated with Zod. New failures use an `AppError` subclass with a useful `cause`.
- [ ] UI text is Spanish; code and logs are English.
- [ ] No secrets, keys or `.env.local` content in the diff (`credentials/` and `.env*` are git-ignored).
- [ ] The docs are updated when behavior, endpoints or setup steps change.
