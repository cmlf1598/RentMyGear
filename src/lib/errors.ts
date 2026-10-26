/**
 * Typed application errors. Every error carries a stable `code` so logs and
 * error boundaries can be filtered/grepped without parsing messages.
 */
export type AppErrorCode =
  | "ENV_INVALID"
  | "INVENTORY_INVALID"
  | "NOT_FOUND"
  | "IMAGE_GENERATION_FAILED"
  | "STORAGE_FAILED"
  | "RENTAL_INVALID";

export class AppError extends Error {
  // Explicit names: production minification strips class names.
  override name = "AppError";
  readonly code: AppErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, { cause: options?.cause });
    this.code = code;
    this.details = options?.details;
  }
}

export class EnvValidationError extends AppError {
  override name = "EnvValidationError";

  constructor(message: string, details?: Record<string, unknown>) {
    super("ENV_INVALID", message, { details });
  }
}

export class InventoryValidationError extends AppError {
  override name = "InventoryValidationError";

  constructor(message: string, details?: Record<string, unknown>) {
    super("INVENTORY_INVALID", message, { details });
  }
}

export class NotFoundError extends AppError {
  override name = "NotFoundError";

  constructor(resource: string, id: string) {
    super("NOT_FOUND", `${resource} "${id}" not found`, { details: { resource, id } });
  }
}

export class ImageGenerationError extends AppError {
  override name = "ImageGenerationError";

  constructor(message: string, options?: { cause?: unknown; details?: Record<string, unknown> }) {
    super("IMAGE_GENERATION_FAILED", message, options);
  }
}

export class StorageError extends AppError {
  override name = "StorageError";

  constructor(message: string, options?: { cause?: unknown; details?: Record<string, unknown> }) {
    super("STORAGE_FAILED", message, options);
  }
}

export class RentalValidationError extends AppError {
  override name = "RentalValidationError";

  constructor(message: string, details?: Record<string, unknown>) {
    super("RENTAL_INVALID", message, { details });
  }
}

/** Flattens an unknown thrown value (including `cause` chains) into log-safe data. */
export function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) return { value: String(error) };
  return {
    name: error.name,
    message: error.message,
    ...(error instanceof AppError && { code: error.code, details: error.details }),
    ...(depth < 3 && error.cause !== undefined && { cause: serializeError(error.cause, depth + 1) }),
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack?.split("\n").slice(1, 6) }),
  };
}
