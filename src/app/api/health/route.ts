import { connection, NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { serializeError } from "@/lib/errors";
import { inventoryService } from "@/services/inventoryService";
import { getStorageService } from "@/services/storageService";

/** Debug endpoint: configuration and dependency status (never exposes secrets). */
export async function GET() {
  await connection();

  const env = getEnv();
  const items = inventoryService.getAll();
  const startedAt = performance.now();

  let storage: Record<string, unknown>;
  try {
    const bucketReachable = await getStorageService().findByPrefix("generated/");
    storage = {
      ok: true,
      bucket: env.GCS_BUCKET_NAME,
      hasGeneratedImages: bucketReachable !== null,
      ms: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    storage = { ok: false, bucket: env.GCS_BUCKET_NAME, error: serializeError(error) };
  }

  return NextResponse.json(
    {
      status: storage.ok ? "ok" : "degraded",
      env: { project: env.GCS_PROJECT_ID, imageModel: env.NANO_BANANA_MODEL, logLevel: env.LOG_LEVEL ?? "default" },
      inventory: {
        total: items.length,
        byCategory: inventoryService.countByCategory(),
        withoutImage: items.filter((item) => !item.imageURL).map((item) => item.id),
      },
      storage,
    },
    { status: storage.ok ? 200 : 503 },
  );
}
