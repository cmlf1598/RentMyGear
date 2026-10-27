import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { EnvValidationError } from "../lib/errors";

const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

/** Hints printed next to each failing variable so the fix is obvious. */
const HINTS: Record<string, string> = {
  GCS_BUCKET_NAME: "Bucket where AI-generated images are stored. Create it with `uv run setup_gcs.py`.",
  GCS_PROJECT_ID: "Google Cloud project ID (not the project name or number), e.g. `rent-my-gear-123456`.",
  GOOGLE_APPLICATION_CREDENTIALS:
    "Absolute or project-relative path to a service-account JSON key with Storage Object Admin on the bucket.",
  NANO_BANANA_API_KEY: "Gemini API key from https://aistudio.google.com/apikey (used for gemini-3-pro-image-preview).",
};

function validateCredentialsFile(value: string, ctx: z.RefinementCtx) {
  // Runtime, user-supplied path: exclude from Turbopack's output file tracing.
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), value);
  if (!fs.existsSync(resolved)) {
    ctx.addIssue({ code: "custom", message: `File does not exist: ${resolved}` });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: `File is not valid JSON (${(error as Error).message}): ${resolved}`,
    });
    return;
  }

  const keyShape = z.object({
    type: z.literal("service_account"),
    project_id: z.string().min(1),
    client_email: z.email(),
    private_key: z.string().includes("PRIVATE KEY"),
  });
  const result = keyShape.safeParse(parsed);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".") || "(root)").join(", ");
    ctx.addIssue({
      code: "custom",
      message: `File is not a service-account key (invalid fields: ${fields}): ${resolved}`,
    });
  }
}

export const envSchema = z.object({
  GCS_BUCKET_NAME: z
    .string({ error: "is required" })
    .trim()
    .regex(BUCKET_NAME_PATTERN, "must be 3-63 chars of lowercase letters, digits, '-', '_' or '.'"),
  GCS_PROJECT_ID: z
    .string({ error: "is required" })
    .trim()
    .regex(PROJECT_ID_PATTERN, "must be 6-30 chars, start with a letter, lowercase letters/digits/hyphens"),
  GOOGLE_APPLICATION_CREDENTIALS: z
    .string({ error: "is required" })
    .trim()
    .min(1, "is required")
    .endsWith(".json", "must point to a .json service-account key file")
    .superRefine(validateCredentialsFile),
  NANO_BANANA_API_KEY: z
    .string({ error: "is required" })
    .trim()
    .min(20, "looks too short to be a valid Gemini API key")
    .refine((v) => !/\s/.test(v), "must not contain whitespace"),
  NANO_BANANA_MODEL: z.string().trim().min(1).default("gemini-3-pro-image-preview"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Formats Zod issues into a human-readable, per-variable report. */
function formatIssues(issues: z.core.$ZodIssue[]): string {
  const byKey = new Map<string, string[]>();
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "(root)");
    byKey.set(key, [...(byKey.get(key) ?? []), issue.message]);
  }

  const lines = [...byKey].map(([key, messages]) => {
    const hint = HINTS[key] ? `\n      ↳ ${HINTS[key]}` : "";
    return `  ✖ ${key}: ${messages.join("; ")}${hint}`;
  });

  return [
    "Invalid server environment configuration.",
    ...lines,
    "",
    "Copy .env.example to .env.local, fill in the values and restart the server.",
  ].join("\n");
}

/** Pure validation entry point (injectable source for tests/scripts). */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // Treat empty strings as missing so `FOO=` in a .env file reports "is required".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvValidationError(formatIssues(result.error.issues), {
      invalidKeys: [...new Set(result.error.issues.map((i) => String(i.path[0])))],
    });
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated, memoized server environment. Throws `EnvValidationError` when broken. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}
