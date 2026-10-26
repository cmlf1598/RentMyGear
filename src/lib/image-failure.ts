import { AppError, StorageError } from "@/lib/errors";

/** User-facing (Spanish) summary of why an AI image could not be produced. */
export interface ImageFailureInfo {
  reason: string;
  /** Short technical tag for debugging, e.g. "Gemini HTTP 402 · RESOURCE_EXHAUSTED". */
  technical: string;
  /** e.g. "en ~8 h", when the provider says how long to wait. */
  retryIn?: string;
  /** Raw provider message, for a tooltip. */
  providerMessage?: string;
}

interface FailureDetails {
  httpStatus?: number;
  providerStatus?: string;
  providerMessage?: string;
  retryAt?: number;
  timedOut?: boolean;
  blockReason?: string;
  finishReason?: string;
}

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  for (let current = error; current !== undefined && chain.length < 5; ) {
    chain.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return chain;
}

function reasonFor(details: FailureDetails, storageFailed: boolean): string {
  if (storageFailed) return "No se pudo acceder a Cloud Storage.";
  if (details.timedOut) return "Gemini tardó demasiado en responder.";
  if (details.blockReason || details.finishReason === "SAFETY") return "Gemini bloqueó la solicitud por sus filtros.";

  switch (details.httpStatus) {
    case 402:
      return "Los créditos de Gemini están agotados.";
    case 429:
      return "Se alcanzó el límite de uso de Gemini.";
    case 400:
      // Gemini reports a bad key as 400 INVALID_ARGUMENT rather than 401.
      return /api key/i.test(details.providerMessage ?? "")
        ? "La API key de Gemini no es válida."
        : "Gemini rechazó la solicitud.";
    case 401:
    case 403:
      return "La API key de Gemini no es válida o no tiene permisos.";
    case 404:
      return "El modelo de imagen no está disponible.";
    case undefined:
      return details.finishReason ? "Gemini no devolvió una imagen." : "No se pudo generar la imagen.";
    default:
      return details.httpStatus >= 500 ? "Gemini no está disponible en este momento." : "No se pudo generar la imagen.";
  }
}

function formatRetryIn(ms: number): string {
  if (ms < 60_000) return "en unos segundos";
  if (ms < 3_600_000) return `en ~${Math.ceil(ms / 60_000)} min`;
  return `en ~${Math.round(ms / 3_600_000)} h`;
}

export function describeImageFailure(error: unknown, now = Date.now()): ImageFailureInfo {
  const chain = causeChain(error);
  const details: FailureDetails = Object.assign(
    {},
    ...chain
      .filter((entry): entry is AppError => entry instanceof AppError)
      .map((entry) => entry.details ?? {})
      .reverse(),
  );
  const storageFailed = chain.some((entry) => entry instanceof StorageError);

  const tag = storageFailed
    ? "Cloud Storage"
    : [details.httpStatus && `Gemini HTTP ${details.httpStatus}`, details.providerStatus ?? details.blockReason]
        .filter(Boolean)
        .join(" · ");
  const fallbackCode = error instanceof AppError ? error.code : "UNKNOWN";

  return {
    reason: reasonFor(details, storageFailed),
    technical: tag || fallbackCode,
    ...(details.retryAt && details.retryAt > now && { retryIn: formatRetryIn(details.retryAt - now) }),
    ...(details.providerMessage && { providerMessage: details.providerMessage }),
  };
}
