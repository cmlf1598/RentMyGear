import { GoogleGenAI } from "@google/genai";

import { CATEGORIES } from "../config/categories";
import { getEnv } from "../config/env";
import { ImageGenerationError } from "../lib/errors";
import { logger as rootLogger, type Logger } from "../lib/logger";
import { getStorageService, type StorageService } from "./storageService";
import type { GearItem, ResolvedImage } from "../types/gear";

export const GENERATED_PREFIX = "generated";

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

export interface ImageGenerator {
  readonly model: string;
  generate(prompt: string): Promise<GeneratedImage>;
}

export interface ImageService {
  /**
   * Resolution order: item.imageURL → in-memory cache → existing GCS object →
   * Nano Banana generation (persisted to GCS). The returned URL becomes the
   * item's effective `imageURL` for every subsequent request.
   */
  resolveImageUrl(item: GearItem): Promise<ResolvedImage>;
  /** Debug helper: forget cached results and failure cooldowns so the next call hits GCS again. */
  clearCache(): void;
}

export interface ImageServiceDeps {
  storage: Pick<StorageService, "findByPrefix" | "uploadImage">;
  generator: ImageGenerator;
  logger?: Logger;
  cache?: Map<string, string>;
  inFlight?: Map<string, Promise<ResolvedImage>>;
  /** After a failure, skip new attempts for this long (avoids hammering Gemini/GCS on every render). */
  failureCooldownMs?: number;
  now?: () => number;
}

interface FailureRecord {
  until: number;
  error: ImageGenerationError;
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function buildImagePrompt(item: GearItem): string {
  const specs = Object.entries(item.specs)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");

  return [
    `Premium e-commerce product photograph of the ${item.brand} ${item.name}, ${CATEGORIES[item.category].imagePromptContext}.`,
    `Product details: ${item.tagline}. ${specs}.`,
    "Single product, centered, three-quarter view, photographed on a seamless soft light-grey studio backdrop",
    "with gentle natural shadow, soft diffused lighting, ultra sharp focus, realistic materials, Apple-style minimal aesthetic.",
    "No text, no logos overlays, no watermark, no people, no hands.",
  ].join(" ");
}

export function generatedObjectPrefix(itemId: string): string {
  return `${GENERATED_PREFIX}/${itemId}.`;
}

export function createImageService({
  storage,
  generator,
  logger = rootLogger.child("imageService"),
  cache = new Map(),
  inFlight = new Map(),
  failureCooldownMs = 30_000,
  now = Date.now,
}: ImageServiceDeps): ImageService {
  const failures = new Map<string, FailureRecord>();

  async function generateAndPersist(item: GearItem): Promise<ResolvedImage> {
    const startedAt = performance.now();
    const existing = await storage.findByPrefix(generatedObjectPrefix(item.id));
    if (existing) {
      cache.set(item.id, existing.publicUrl);
      logger.info("Reusing persisted AI image", { itemId: item.id, url: existing.publicUrl });
      return { url: existing.publicUrl, source: "gcs", isAiGenerated: true };
    }

    const prompt = buildImagePrompt(item);
    logger.info("Generating image with Nano Banana", { itemId: item.id, model: generator.model });
    logger.debug("Image prompt", { itemId: item.id, prompt });

    const image = await generator.generate(prompt);
    const extension = EXTENSIONS[image.mimeType] ?? "png";
    const stored = await storage.uploadImage(
      `${generatedObjectPrefix(item.id)}${extension}`,
      image.data,
      image.mimeType,
      { itemId: item.id, model: generator.model, generatedAt: new Date().toISOString() },
    );

    cache.set(item.id, stored.publicUrl);
    logger.info("AI image generated and persisted", {
      itemId: item.id,
      url: stored.publicUrl,
      bytes: image.data.byteLength,
      ms: Math.round(performance.now() - startedAt),
    });
    return { url: stored.publicUrl, source: "generated", isAiGenerated: true };
  }

  return {
    async resolveImageUrl(item) {
      if (item.imageURL) return { url: item.imageURL, source: "origin", isAiGenerated: false };

      const cached = cache.get(item.id);
      if (cached) return { url: cached, source: "memory", isAiGenerated: true };

      // Deduplicate concurrent requests (e.g. carousel + grid rendering the same item).
      const pending = inFlight.get(item.id);
      if (pending) return pending;

      const failure = failures.get(item.id);
      if (failure && failure.until > now()) {
        logger.debug("Skipping image resolution during failure cooldown", {
          itemId: item.id,
          retryInMs: failure.until - now(),
        });
        throw failure.error;
      }

      const task = generateAndPersist(item)
        .then((image) => {
          failures.delete(item.id);
          return image;
        })
        .catch((error: unknown) => {
          logger.error("Image resolution failed", { itemId: item.id, error });
          const wrapped =
            error instanceof ImageGenerationError
              ? error
              : new ImageGenerationError(`Could not resolve an image for "${item.id}"`, {
                  cause: error,
                  details: { itemId: item.id },
                });
          failures.set(item.id, { until: now() + failureCooldownMs, error: wrapped });
          throw wrapped;
        })
        .finally(() => inFlight.delete(item.id));

      inFlight.set(item.id, task);
      return task;
    },

    clearCache() {
      cache.clear();
      failures.clear();
    },
  };
}

export interface ProviderErrorDetails {
  httpStatus?: number;
  providerStatus?: string;
  providerMessage?: string;
  /** Absolute epoch ms after which Gemini says a retry may succeed (from `RetryInfo`). */
  retryAt?: number;
  timedOut?: boolean;
}

/**
 * Extracts the useful bits of a `@google/genai` ApiError, whose `message` is the
 * raw JSON error body, e.g. `{"error":{"code":429,"status":"RESOURCE_EXHAUSTED",...}}`.
 */
export function parseProviderError(cause: unknown, now = Date.now()): ProviderErrorDetails {
  if (!(cause instanceof Error)) return {};
  if (cause.name === "AbortError" || /timed? ?out/i.test(cause.message)) return { timedOut: true };

  const httpStatus = "status" in cause && typeof cause.status === "number" ? cause.status : undefined;
  let body: { status?: string; message?: string; details?: { "@type"?: string; retryDelay?: string }[] } = {};
  try {
    body = (JSON.parse(cause.message) as { error?: typeof body }).error ?? {};
  } catch {
    body = { message: cause.message };
  }

  const retryDelay = body.details?.find((detail) => detail["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const retrySeconds = retryDelay ? Number.parseFloat(retryDelay) : Number.NaN;

  return {
    httpStatus,
    providerStatus: body.status,
    // First sentence only; the rest is links and per-metric quota breakdowns.
    providerMessage: body.message?.split(/(?<=\.)\s/)[0]?.trim().slice(0, 200),
    ...(Number.isFinite(retrySeconds) && { retryAt: now + retrySeconds * 1000 }),
  };
}

export interface NanoBananaOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/** Nano Banana Pro (Gemini 3 Pro Image) adapter. */
export function createNanoBananaGenerator({
  apiKey,
  model,
  timeoutMs = 120_000,
}: NanoBananaOptions): ImageGenerator {
  const client = new GoogleGenAI({ apiKey });

  return {
    model,
    async generate(prompt) {
      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "4:3", imageSize: "1K" },
            httpOptions: { timeout: timeoutMs },
          },
        });
      } catch (cause) {
        throw new ImageGenerationError(`Nano Banana request failed (${model})`, {
          cause,
          details: { model, ...parseProviderError(cause) },
        });
      }

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const inline = parts.find((part) => part.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        throw new ImageGenerationError("Nano Banana returned no image data", {
          details: {
            model,
            finishReason: response.candidates?.[0]?.finishReason,
            blockReason: response.promptFeedback?.blockReason,
            text: parts.map((part) => part.text).filter(Boolean).join(" ").slice(0, 300),
          },
        });
      }

      return { data: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType ?? "image/png" };
    },
  };
}

// Survive dev-server HMR so a hot reload doesn't trigger duplicate generations.
const globalStore = globalThis as typeof globalThis & {
  __rmgImageCache?: Map<string, string>;
  __rmgImageInFlight?: Map<string, Promise<ResolvedImage>>;
};

let instance: ImageService | undefined;

export function getImageService(): ImageService {
  if (!instance) {
    const env = getEnv();
    instance = createImageService({
      storage: getStorageService(),
      generator: createNanoBananaGenerator({ apiKey: env.NANO_BANANA_API_KEY, model: env.NANO_BANANA_MODEL }),
      cache: (globalStore.__rmgImageCache ??= new Map()),
      inFlight: (globalStore.__rmgImageInFlight ??= new Map()),
    });
  }
  return instance;
}
