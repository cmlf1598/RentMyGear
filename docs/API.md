# API reference

The app has four route handlers in `src/app/api/`. Two are used by the UI (`availability`, `rentals`). Two
are debugging endpoints that also work well for checking a deployment (`health`, `images`).

- Every response is JSON.
- Error bodies always have an `error` string. `422` responses also carry `fieldErrors`.
- The examples are real responses from a local dev server. The exceptions are the health `503` and the
  images `502`: those show the shape the code produces, with `…` where values vary.

> **PowerShell users:** `curl` is an alias for `Invoke-WebRequest` there. Use `curl.exe` for the examples
> below.

| Method | Path | Used by | Purpose |
|---|---|---|---|
| `GET` | [`/api/health`](#get-apihealth) | You, monitoring | Config summary, inventory stats and a live GCS check |
| `GET` | [`/api/images/:id`](#get-apiimagesid) | You | Resolve (and if needed generate) one item's image, and say where it came from |
| `GET` | [`/api/availability/:id`](#get-apiavailabilityid) | `RentalFlow` | An item's booked date ranges, as of now |
| `POST` | [`/api/rentals`](#post-apirentals) | `RentalFlow` | Mock booking: validate, recalculate the price, confirm |

---

## `GET /api/health`

Reports the configuration (no secrets), the state of the inventory, and a live call to the GCS bucket. The
GCS call is `findByPrefix("generated/")`. This is the first thing to check when images fail.

```bash
curl http://localhost:3000/api/health
```

**200 OK** when GCS answered:

```json
{
  "status": "ok",
  "env": { "project": "rent-my-gear-512822", "imageModel": "gemini-3-pro-image-preview", "logLevel": "default" },
  "inventory": {
    "total": 50,
    "byCategory": { "fotografia-video": 17, "montana-camping": 17, "deportes-acuaticos": 16 },
    "withoutImage": ["blackmagic-pocket-6k-pro", "dji-ronin-4d", "…"]
  },
  "storage": { "ok": true, "bucket": "rent-my-gear-cmlf-2026", "hasGeneratedImages": true, "ms": 483 }
}
```

**503 Service Unavailable** (`"status": "degraded"`) when the GCS call failed. `storage.error` holds the
serialized `StorageError` and its cause chain. The cause tells you what went wrong: permission denied, bucket
not found, an invalid key, and so on.

```json
{
  "status": "degraded",
  "storage": {
    "ok": false,
    "bucket": "rent-my-gear-cmlf-2026",
    "error": {
      "name": "StorageError",
      "code": "STORAGE_FAILED",
      "message": "GCS findByPrefix failed for \"generated/\" in bucket \"rent-my-gear-cmlf-2026\"",
      "details": { "operation": "findByPrefix", "path": "generated/", "bucket": "rent-my-gear-cmlf-2026" },
      "cause": { "name": "ApiError", "message": "…" }
    }
  }
}
```

`withoutImage` lists the items whose image comes from Nano Banana rather than Unsplash.

---

## `GET /api/images/:id`

Runs the same resolution as the UI (`imageService.resolveImageUrl`, see
[ARCHITECTURE.md › Image resolution flow](ARCHITECTURE.md#7-image-resolution-flow)) and reports which step
answered.

> ⚠️ For an item without an image this **calls Nano Banana and spends Gemini credits**. That happens once per
> item; after that the image is served from memory or GCS.

| Query | Effect |
|---|---|
| `?fresh` | Clears the in-memory cache and the 30 s failure cooldowns first, so the next lookup goes to GCS (or regenerates if the object is missing). |

```bash
curl http://localhost:3000/api/images/sony-a7-iv
curl "http://localhost:3000/api/images/blackmagic-pocket-6k-pro?fresh"
```

**200 OK**

```json
{ "itemId": "sony-a7-iv", "imageURL": "https://images.unsplash.com/photo-1606986628470-…&w=1600&q=80&fit=crop&auto=format", "source": "origin", "isAiGenerated": false, "ms": 0 }
```

```json
{ "itemId": "blackmagic-pocket-6k-pro", "imageURL": "https://storage.googleapis.com/rent-my-gear-cmlf-2026/generated/blackmagic-pocket-6k-pro.jpg", "source": "memory", "isAiGenerated": true, "ms": 0 }
```

| `source` | Meaning |
|---|---|
| `origin` | The item has an `imageURL` in `inventory.json` (Unsplash). |
| `memory` | The URL was cached in memory by this server process. |
| `gcs` | Found in the bucket under `generated/<id>.*`. Generated earlier, possibly before a restart. |
| `generated` | Nano Banana just generated it and it was uploaded to GCS. Expect `ms` around 10,000–20,000. |

**404 Not Found**: `{ "error": "Item \"nope\" not found" }`

**502 Bad Gateway** when the image could not be produced:

```json
{
  "itemId": "seabob-f5-sr",
  "failure": {
    "reason": "Se alcanzó el límite de uso de Gemini.",
    "technical": "Gemini HTTP 429 · RESOURCE_EXHAUSTED",
    "retryIn": "en ~2 min",
    "providerMessage": "You exceeded your current quota."
  },
  "error": { "name": "ImageGenerationError", "code": "IMAGE_GENERATION_FAILED", "details": { "…": "…" }, "cause": { "…": "…" } }
}
```

`failure` is exactly what the UI shows in the "Imagen no disponible" placeholder. When GCS is the problem,
`failure.technical` is `"Cloud Storage"` and the reason is "No se pudo acceder a Cloud Storage.".

> The handler has a `503` branch for errors with code `STORAGE_FAILED`, but in practice it never triggers.
> `imageService` wraps every failure, storage failures included, in an `ImageGenerationError`, so failures
> come back as `502`. Use `failure.technical` or `error.cause` to tell storage problems apart.

---

## `GET /api/availability/:id`

The item's booked ranges, resolved against the server's "today". The response is never cached
(`Cache-Control: no-store`). `RentalFlow` calls this every 30 s, when the window regains focus, and just
before confirming a booking.

```bash
curl http://localhost:3000/api/availability/red-paddle-ride-108
```

**200 OK**

```json
{
  "itemId": "red-paddle-ride-108",
  "bookedRanges": [
    { "from": "2026-10-30T06:00:00.000Z", "to": "2026-10-31T06:00:00.000Z" },
    { "from": "2026-11-10T06:00:00.000Z", "to": "2026-11-12T06:00:00.000Z" }
  ],
  "checkedAt": "2026-10-27T02:09:11.662Z"
}
```

- Ranges are **inclusive**: both `from` and `to` are booked days.
- Each value is local midnight on the server, serialized as ISO. These examples come from a server at UTC−6.

**404 Not Found**: `{ "error": "Item \"nope\" not found" }`

---

## `POST /api/rentals`

Mock booking. The server re-validates the request with the same Zod schema the UI uses
(`createRentalRequestSchema`), but with its own clock and the item's current bookings. It then
**recalculates the price**; a total sent by the browser would never be trusted. The handler waits about 900 ms
on purpose, so the UI's loading state is visible. Nothing is saved.

**Request body**

```json
{ "itemId": "sony-a7-iv", "from": "2026-12-05", "to": "2026-12-07" }
```

| Field | Type | Rules |
|---|---|---|
| `itemId` | string | Must exist in the inventory. |
| `from` | `yyyy-MM-dd` | Today or later (server time). |
| `to` | `yyyy-MM-dd` | On or after `from`. At most 30 days in total, counting both ends. Must not overlap a booked range. |

```bash
curl -X POST http://localhost:3000/api/rentals \
  -H "Content-Type: application/json" \
  -d '{"itemId":"sony-a7-iv","from":"2026-12-05","to":"2026-12-07"}'
```

**201 Created**

```json
{
  "confirmationCode": "RMG-RYO3IMHCT",
  "itemId": "sony-a7-iv",
  "from": "2026-12-05",
  "to": "2026-12-07",
  "days": 3,
  "total": 210.6,
  "deposit": 800,
  "createdAt": "2026-10-27T02:09:27.363Z"
}
```

- `total` is $65 × 3 days plus the 8% service fee.
- `deposit` is a refundable hold, separate from `total`.

**Errors**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "El cuerpo de la solicitud no es JSON válido" }` | The body isn't JSON |
| `404` | `{ "error": "El equipo no existe" }` | Unknown or missing `itemId` (checked before the schema) |
| `422` | `{ "error": "Solicitud inválida", "fieldErrors": { "from": "…", "to": "…" } }` | Failed validation; see the messages below |
| `500` | `{ "error": "No pudimos procesar la renta", "debug": { … } }` | Unexpected error. `debug` is omitted in production. |

The `fieldErrors` messages:

| Field | Message |
|---|---|
| `from` | "La fecha de inicio no puede estar en el pasado" |
| `to` | "La fecha de devolución no puede estar en el pasado" |
| `to` | "La devolución debe ser igual o posterior a la fecha de inicio" |
| `to` | "El periodo máximo de renta es de 30 días" |
| `from` | "Las fechas seleccionadas incluyen días no disponibles" |
