import { describe, expect, it } from "vitest";

import { ImageGenerationError, StorageError } from "../../lib/errors";
import { describeImageFailure } from "../../lib/image-failure";

const NOW = 1_800_000_000_000;
const gemini = (details: Record<string, unknown>) =>
  new ImageGenerationError("Nano Banana request failed", { details: { model: "gemini-3-pro-image-preview", ...details } });

describe("describeImageFailure", () => {
  it.each([
    [402, "Los créditos de Gemini están agotados."],
    [429, "Se alcanzó el límite de uso de Gemini."],
    [401, "La API key de Gemini no es válida o no tiene permisos."],
    [403, "La API key de Gemini no es válida o no tiene permisos."],
    [404, "El modelo de imagen no está disponible."],
    [503, "Gemini no está disponible en este momento."],
    [418, "No se pudo generar la imagen."],
  ])("explains HTTP %i", (httpStatus, reason) => {
    expect(describeImageFailure(gemini({ httpStatus }), NOW)).toMatchObject({
      reason,
      technical: `Gemini HTTP ${httpStatus}`,
    });
  });

  it("tells an invalid API key apart from other 400s", () => {
    const badKey = gemini({ httpStatus: 400, providerStatus: "INVALID_ARGUMENT", providerMessage: "API key not valid." });
    const otherBad = gemini({ httpStatus: 400 });

    expect(describeImageFailure(badKey, NOW)).toEqual({
      reason: "La API key de Gemini no es válida.",
      technical: "Gemini HTTP 400 · INVALID_ARGUMENT",
      providerMessage: "API key not valid.",
    });
    expect(describeImageFailure(otherBad, NOW).reason).toBe("Gemini rechazó la solicitud.");
  });

  it("reports timeouts", () => {
    expect(describeImageFailure(gemini({ timedOut: true }), NOW)).toMatchObject({
      reason: "Gemini tardó demasiado en responder.",
      technical: "IMAGE_GENERATION_FAILED",
    });
  });

  it("reports safety blocks from either blockReason or finishReason", () => {
    expect(describeImageFailure(gemini({ blockReason: "SAFETY" }), NOW)).toMatchObject({
      reason: "Gemini bloqueó la solicitud por sus filtros.",
      technical: "SAFETY",
    });
    expect(describeImageFailure(gemini({ finishReason: "SAFETY" }), NOW).reason).toBe(
      "Gemini bloqueó la solicitud por sus filtros.",
    );
  });

  it("distinguishes 'no image returned' from an unknown failure", () => {
    expect(describeImageFailure(gemini({ finishReason: "OTHER" }), NOW).reason).toBe("Gemini no devolvió una imagen.");
    expect(describeImageFailure(gemini({}), NOW).reason).toBe("No se pudo generar la imagen.");
  });

  it("blames Cloud Storage when a StorageError is anywhere in the cause chain", () => {
    const storage = new StorageError("GCS findByPrefix failed", { details: { operation: "findByPrefix" } });
    const wrapped = new ImageGenerationError('Could not resolve an image for "x"', { cause: storage });

    expect(describeImageFailure(wrapped, NOW)).toEqual({
      reason: "No se pudo acceder a Cloud Storage.",
      technical: "Cloud Storage",
    });
  });

  it.each([
    [30_000, "en unos segundos"],
    [5 * 60_000 + 1, "en ~6 min"],
    [3 * 3_600_000, "en ~3 h"],
  ])("formats a retry %i ms away as %s", (delay, retryIn) => {
    expect(describeImageFailure(gemini({ httpStatus: 429, retryAt: NOW + delay }), NOW).retryIn).toBe(retryIn);
  });

  it("omits the retry hint once the retry time has passed", () => {
    expect(describeImageFailure(gemini({ httpStatus: 429, retryAt: NOW - 1 }), NOW)).not.toHaveProperty("retryIn");
  });

  it("falls back to the error code, or UNKNOWN for errors that aren't AppErrors", () => {
    expect(describeImageFailure(new ImageGenerationError("no details"), NOW).technical).toBe("IMAGE_GENERATION_FAILED");
    expect(describeImageFailure(new Error("plain"), NOW)).toEqual({
      reason: "No se pudo generar la imagen.",
      technical: "UNKNOWN",
    });
  });

  it("stops walking the cause chain at a non-Error cause", () => {
    const error = new ImageGenerationError("wrapped", { cause: "socket hang up", details: { httpStatus: 503 } });
    expect(describeImageFailure(error, NOW).technical).toBe("Gemini HTTP 503");
  });

  it("uses the current time by default", () => {
    expect(describeImageFailure(gemini({ httpStatus: 429, retryAt: Date.now() + 10 * 60_000 })).retryIn).toBe("en ~10 min");
  });
});
