import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  EnvValidationError,
  ImageGenerationError,
  NotFoundError,
  serializeError,
  StorageError,
} from "../../lib/errors";
import { createLogger } from "../../lib/logger";

describe("AppError subclasses", () => {
  it.each([
    [new EnvValidationError("bad env", { invalidKeys: ["X"] }), "EnvValidationError", "ENV_INVALID"],
    [new StorageError("gcs down", { details: { bucket: "b" } }), "StorageError", "STORAGE_FAILED"],
    [new NotFoundError("Gear item", "x"), "NotFoundError", "NOT_FOUND"],
  ])("%s carries a stable name and code", (error, name, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ name, code });
  });
});

describe("serializeError", () => {
  it("wraps values that aren't errors", () => {
    expect(serializeError("oops")).toEqual({ value: "oops" });
  });

  it("includes the code, details and cause chain of app errors", () => {
    const error = new ImageGenerationError("outer", { cause: new Error("inner"), details: { itemId: "x" } });

    expect(serializeError(error)).toMatchObject({
      name: "ImageGenerationError",
      message: "outer",
      code: "IMAGE_GENERATION_FAILED",
      details: { itemId: "x" },
      cause: { name: "Error", message: "inner" },
    });
  });

  it("stops after three levels of causes", () => {
    let error = new Error("level 0");
    for (let level = 1; level <= 5; level++) error = new Error(`level ${level}`, { cause: error });

    const serialized = serializeError(error);
    expect(serialized.cause).toMatchObject({ cause: { cause: { message: "level 2" } } });
    expect((serialized.cause as { cause: { cause: Record<string, unknown> } }).cause.cause).not.toHaveProperty("cause");
  });

  it("omits stack traces in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(serializeError(new Error("x"))).not.toHaveProperty("stack");
  });
});

describe("createLogger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes scoped, readable lines in development, to the console method for each level", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("app", "debug").child("test");

    logger.debug("d");
    logger.info("i", { n: 1 });
    logger.warn("w");
    logger.error("e", { error: new Error("boom") });

    expect(log).toHaveBeenNthCalledWith(1, "[DEBUG] [app:test]", "d");
    expect(log).toHaveBeenNthCalledWith(2, "[INFO ] [app:test]", "i", { n: 1 });
    expect(warn).toHaveBeenCalledWith("[WARN ] [app:test]", "w");
    expect(error).toHaveBeenCalledWith("[ERROR] [app:test]", "e", { error: expect.objectContaining({ message: "boom" }) });
  });

  it("drops messages below the configured level", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createLogger("app", "warn");

    logger.info("hidden");
    logger.warn("shown");

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("writes one JSON object per line in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("app", "info").info("hello", { itemId: "x" });

    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      level: "info",
      scope: "app",
      message: "hello",
      itemId: "x",
    });
  });

  it.each([
    ["LOG_LEVEL=error", { LOG_LEVEL: "error" }, 1],
    ["an invalid LOG_LEVEL in production (info)", { LOG_LEVEL: "nonsense", NODE_ENV: "production" }, 2],
    ["no LOG_LEVEL in development (debug)", { LOG_LEVEL: "", NODE_ENV: "development" }, 3],
  ] as const)("picks the default level from %s", (_, env, linesWritten) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createLogger();
    logger.debug("d");
    logger.info("i");
    logger.error("e");

    expect(log.mock.calls.length + error.mock.calls.length).toBe(linesWritten);
  });
});
