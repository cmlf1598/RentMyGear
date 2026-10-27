# Rent my Gear

A marketplace for renting premium equipment: cinema cameras, mountaineering gear and water-sports equipment.
You browse by category, pick dates on a calendar, see the full price, and confirm a booking.

**Smart Insurance** is included in every rental: **20%** of the rental for photography and video equipment, **10%**
for everything else. It appears as its own line in the price and is recalculated on the server.

When an item has no product photo, the server generates one with **Nano Banana Pro** (Gemini 3 Pro Image) and
stores it in **Google Cloud Storage**. Every later visit uses the stored image.

The UI is in Spanish and the code is in English. Built with Next.js 16, React 19, shadcn/ui, Tailwind CSS 4
and Zod.

## Documentation

| Document | Read it to… |
|---|---|
| [Onboarding Guide](docs/ONBOARDING.md) | Set up your machine, tour the code, learn the conventions, **debug the GCS connection** and **add a new category**. Start here if you're new. |
| [Architecture](docs/ARCHITECTURE.md) | Understand the rendering model, services, domain model, validation and error handling. Includes the **image resolution sequence diagram** and the **inventoryService / imageService class diagram**. |
| [API reference](docs/API.md) | Call the HTTP endpoints, including `/api/health` and `/api/images/:id` for debugging. |
| [Testing](docs/TESTING.md) | See what the Vitest suite covers, the TDD log for Smart Insurance, coverage (100% on the rental module) and the known gaps. |

## Quick start

You need Node.js 24, [uv](https://docs.astral.sh/uv/), a Google Cloud project with billing, and a Gemini API
key with billing. The [Onboarding Guide](docs/ONBOARDING.md#2-first-time-setup) explains where to get each
value.

```bash
npm install
cp .env.example .env.local   # fill in GCS_*, GOOGLE_APPLICATION_CREDENTIALS, NANO_BANANA_API_KEY
npm run setup:gcs            # create the bucket, make it publicly readable, run a smoke test
npm run dev                  # http://localhost:3000
```

The server checks its environment at start-up and **refuses to start** if anything is missing or malformed,
printing what to fix. Once it is running, open <http://localhost:3000/api/health> to confirm that it can reach
GCS.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript (strict) |
| `npm test` / `npm run test:watch` | Vitest: unit, integration and edge-case tests |
| `npm run test:coverage` | Tests plus coverage; fails below 100% for the rental module and Smart Insurance |
| `npm run setup:gcs` | Create or check the GCS bucket (`uv run setup_gcs.py`; `-- --smoke-only` only checks permissions) |
| `npm run seed:images` | Fill missing `imageURL`s from Unsplash (`-- --dry-run`, `-- --force`) |

## How it works

```text
inventory.json ──► inventoryService ──► pages / carousel / grid ──► GearImage
                    (Zod-validated)                                    │
                                    imageURL set? ── yes ──► Unsplash photo
                                          │ no
                                          ▼
                     imageService: memory cache ─► GCS generated/<id>.* ─► Nano Banana ─► upload to GCS
```

- **Pages render in parts (Partial Prerendering).** The static parts are prerendered. Anything that depends on
  the request streams in through `<Suspense>`: random picks, availability, and images being generated.
- **The rental wizard** goes dates → summary → confirm, and uses the same Zod schema in the browser and on the
  server. The price is rental + Smart Insurance + an 8% service fee, and the server recalculates it. The booking
  API is a mock.
- **Expected failures show a message.** If the Gemini quota or credits run out, or GCS is unreachable, that
  image's placeholder shows "Imagen no disponible" with the reason and when to retry. The rest of the page keeps
  working.

The details, with diagrams, are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project layout

```text
src/app          routes, layouts, error boundaries, API route handlers
src/components   features/ (domain UI), layout/, shared/, ui/ (shadcn)
src/services     inventory, image (Nano Banana), storage (GCS), rental (mock booking)
src/lib          pure helpers: Smart Insurance, dates and pricing, validation, errors, logger
src/config       environment schema, category definitions
src/data         inventory.json (50 items)
src/__tests__    unit, integration and edge-case tests (Vitest + React Testing Library)
docs/            the documentation listed above
```
