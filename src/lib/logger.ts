import { serializeError } from "@/lib/errors";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(scope: string): Logger;
}

function resolveLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && raw in LEVELS) return raw as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function normalize(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      value instanceof Error ? serializeError(value) : value,
    ]),
  );
}

/**
 * Minimal structured logger. Pretty, scoped lines in development and one JSON
 * object per line in production (friendly to Cloud Logging and similar).
 */
export function createLogger(scope = "app", level: LogLevel = resolveLevel()): Logger {
  const threshold = LEVELS[level];
  const json = process.env.NODE_ENV === "production";

  const write = (lvl: LogLevel, message: string, context?: LogContext) => {
    if (LEVELS[lvl] < threshold) return;
    const ctx = normalize(context);
    const sink = lvl === "error" ? console.error : lvl === "warn" ? console.warn : console.log;
    if (json) {
      sink(JSON.stringify({ time: new Date().toISOString(), level: lvl, scope, message, ...ctx }));
    } else {
      const prefix = `[${lvl.toUpperCase().padEnd(5)}] [${scope}]`;
      if (ctx) sink(prefix, message, ctx);
      else sink(prefix, message);
    }
  };

  return {
    debug: (m, c) => write("debug", m, c),
    info: (m, c) => write("info", m, c),
    warn: (m, c) => write("warn", m, c),
    error: (m, c) => write("error", m, c),
    child: (child) => createLogger(`${scope}:${child}`, level),
  };
}

export const logger = createLogger();
