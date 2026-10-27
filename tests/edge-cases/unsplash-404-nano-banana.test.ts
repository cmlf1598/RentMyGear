import { beforeEach, describe, expect, it, vi } from "vitest";

import { describeImageFailure } from "@/lib/image-failure";
import type { Logger } from "@/lib/logger";
import { ImageGenerationError } from "@/lib/errors";
import { createImageService, createNanoBananaGenerator, type ImageServiceDeps } from "@/services/imageService";
import { inventoryService } from "@/services/inventoryService";
import type { GearItem } from "@/types/gear";

import { type InventoryItem, searchFirstPhoto, seedInventoryImages, type UnsplashPhoto } from "../../scripts/unsplash";

// Only the Gemini SDK client is faked; the Nano Banana adapter around it is the real one.
const generateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const PNG_BYTES = Buffer.from("fake-png-bytes");
const imageResponse = () => ({
  candidates: [{ content: { parts: [{ inlineData: { data: PNG_BYTES.toString("base64"), mimeType: "image/png" } }] } }],
});

/** Shape of a `@google/genai` ApiError: numeric status, raw JSON body as the message. */
function geminiApiError(status: number, body: Record<string, unknown>) {
  return Object.assign(new Error(JSON.stringify({ error: body })), { name: "ApiError", status });
}

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {}, child: () => silentLogger };

/** In-memory stand-in for the GCS bucket. */
function fakeBucket() {
  const objects = new Map<string, { data: Buffer; contentType: string; metadata?: Record<string, string> }>();
  const publicUrl = (path: string) => `https://storage.googleapis.com/test-bucket/${path}`;
  const storage: ImageServiceDeps["storage"] = {
    findByPrefix: vi.fn(async (prefix: string) => {
      const path = [...objects.keys()].find((key) => key.startsWith(prefix));
      return path ? { path, publicUrl: publicUrl(path) } : null;
    }),
    uploadImage: vi.fn(async (path: string, data: Buffer, contentType: string, metadata?: Record<string, string>) => {
      objects.set(path, { data, contentType, metadata });
      return { path, publicUrl: publicUrl(path) };
    }),
  };
  return { objects, storage, publicUrl };
}

function imageServiceFor(storage: ImageServiceDeps["storage"], now = () => Date.now()) {
  return createImageService({
    storage,
    generator: createNanoBananaGenerator({ apiKey: "test-key", model: "gemini-3-pro-image-preview" }),
    logger: silentLogger,
    now,
  });
}

function notFoundResponse() {
  return new Response(JSON.stringify({ errors: ["Not found"] }), { status: 404 });
}

const unsplashPhoto: UnsplashPhoto = {
  urls: { raw: "https://images.unsplash.com/photo-123?ixid=abc", regular: "https://images.unsplash.com/photo-123" },
  links: { html: "https://unsplash.com/photos/123" },
  user: { name: "Ana Fotógrafa", links: { html: "https://unsplash.com/@ana" } },
  alt_description: null,
};

/** Seed-shaped copy of a real inventory item, as it is before seeding. */
function unseeded(id: string): InventoryItem {
  return { ...structuredClone(inventoryService.getByIdOrThrow(id)), imageURL: null, imageCredit: null };
}

beforeEach(() => {
  generateContent.mockReset();
});

describe("Unsplash search returns 404", () => {
  it("is treated as 'no photo' without retrying", async () => {
    const fetch = vi.fn(async () => notFoundResponse());
    const sleep = vi.fn(async () => {});

    await expect(searchFirstPhoto("Starboard Touring 12'6\"", "key", { fetch, sleep })).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("unlike 5xx, which is retried and then fails loudly", async () => {
    const fetch = vi.fn(async () => new Response("upstream down", { status: 503 }));
    const sleep = vi.fn(async () => {});

    await expect(searchFirstPhoto("anything", "key", { fetch, sleep })).rejects.toThrow(/HTTP 503/);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("unlike 401, which aborts the seed immediately", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 401 }));

    await expect(searchFirstPhoto("anything", "bad-key", { fetch })).rejects.toThrow(/access key \(401\)/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("leaves that item without imageURL and keeps seeding the rest", async () => {
    const missing = unseeded("starboard-touring-126");
    const found = unseeded("torq-longboard-9");
    const fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("Starboard")
        ? notFoundResponse()
        : Response.json({ results: [unsplashPhoto] }),
    );
    const onSeeded = vi.fn();

    const result = await seedInventoryImages([missing, found], {
      search: (query) => searchFirstPhoto(query, "key", { fetch }),
      onSeeded,
    });

    expect(result).toEqual({ seeded: 1, failures: ["starboard-touring-126"] });
    expect(missing).toMatchObject({ imageURL: null, imageCredit: null });
    expect(found.imageURL).toMatch(/^https:\/\/images\.unsplash\.com\/photo-123\?.*w=1600/);
    expect(onSeeded).toHaveBeenCalledExactlyOnceWith(found, unsplashPhoto);
  });
});

describe("Nano Banana fallback for an item Unsplash couldn't fill", () => {
  let item: GearItem;

  beforeEach(async () => {
    const seeded = unseeded("starboard-touring-126");
    await seedInventoryImages([seeded], {
      search: (query) => searchFirstPhoto(query, "key", { fetch: async () => notFoundResponse() }),
    });
    item = seeded as GearItem;
    expect(item.imageURL).toBeNull();
  });

  it("generates the image on first request and persists it to GCS", async () => {
    generateContent.mockResolvedValueOnce(imageResponse());
    const bucket = fakeBucket();

    const image = await imageServiceFor(bucket.storage).resolveImageUrl(item);

    const path = "generated/starboard-touring-126.png";
    expect(image).toEqual({ url: bucket.publicUrl(path), source: "generated", isAiGenerated: true });
    expect(bucket.objects.get(path)).toMatchObject({
      data: PNG_BYTES,
      contentType: "image/png",
      metadata: { itemId: item.id, model: "gemini-3-pro-image-preview" },
    });

    const [request] = generateContent.mock.calls[0];
    expect(request.model).toBe("gemini-3-pro-image-preview");
    expect(request.contents).toContain(`${item.brand} ${item.name}`);
    expect(request.config.responseModalities).toEqual(["IMAGE"]);
  });

  it("serves later requests from memory, and from GCS after a restart, without regenerating", async () => {
    generateContent.mockResolvedValueOnce(imageResponse());
    const bucket = fakeBucket();
    const service = imageServiceFor(bucket.storage);

    const first = await service.resolveImageUrl(item);
    const second = await service.resolveImageUrl(item);
    const afterRestart = await imageServiceFor(bucket.storage).resolveImageUrl(item);

    expect(second).toEqual({ ...first, source: "memory" });
    expect(afterRestart).toEqual({ ...first, source: "gcs" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(bucket.storage.uploadImage).toHaveBeenCalledTimes(1);
  });

  it("runs a single generation when several components request the image at once", async () => {
    generateContent.mockResolvedValueOnce(imageResponse());
    const service = imageServiceFor(fakeBucket().storage);

    const results = await Promise.all([1, 2, 3].map(() => service.resolveImageUrl(item)));

    expect(new Set(results.map((result) => result.url)).size).toBe(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not call Nano Banana for items Unsplash did fill", async () => {
    const service = imageServiceFor(fakeBucket().storage);
    const withPhoto = { ...item, imageURL: "https://images.unsplash.com/photo-123?w=1600" };

    await expect(service.resolveImageUrl(withPhoto)).resolves.toEqual({
      url: withPhoto.imageURL,
      source: "origin",
      isAiGenerated: false,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("when Nano Banana is rate-limited too: explains it in Spanish, backs off, then recovers", async () => {
    let clock = Date.now();
    generateContent.mockRejectedValueOnce(
      geminiApiError(429, {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "You exceeded your current quota. Please check your plan.",
        details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "120s" }],
      }),
    );
    const bucket = fakeBucket();
    const service = imageServiceFor(bucket.storage, () => clock);

    const failure = await service.resolveImageUrl(item).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ImageGenerationError);
    expect(describeImageFailure(failure)).toEqual({
      reason: "Se alcanzó el límite de uso de Gemini.",
      technical: "Gemini HTTP 429 · RESOURCE_EXHAUSTED",
      retryIn: "en ~2 min",
      providerMessage: "You exceeded your current quota.",
    });
    expect(bucket.objects.size).toBe(0);

    // Within the 30 s cooldown the same error is returned without calling Gemini again.
    clock += 10_000;
    await expect(service.resolveImageUrl(item)).rejects.toBe(failure);
    expect(generateContent).toHaveBeenCalledTimes(1);

    clock += 30_000;
    generateContent.mockResolvedValueOnce(imageResponse());
    await expect(service.resolveImageUrl(item)).resolves.toMatchObject({ source: "generated" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("when Gemini's safety filter returns no image: fails with a readable reason, nothing stored", async () => {
    generateContent.mockResolvedValueOnce({ candidates: [], promptFeedback: { blockReason: "SAFETY" } });
    const bucket = fakeBucket();

    const failure = await imageServiceFor(bucket.storage)
      .resolveImageUrl(item)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ImageGenerationError);
    expect(describeImageFailure(failure)).toMatchObject({
      reason: "Gemini bloqueó la solicitud por sus filtros.",
      technical: "SAFETY",
    });
    expect(bucket.objects.size).toBe(0);
  });
});
