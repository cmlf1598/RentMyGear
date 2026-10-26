import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";

/** Node.js-only startup checks; a broken configuration aborts the process. */
export function validateStartup() {
  try {
    const env = getEnv();
    logger.child("startup").info("Environment validated", {
      bucket: env.GCS_BUCKET_NAME,
      project: env.GCS_PROJECT_ID,
      imageModel: env.NANO_BANANA_MODEL,
    });
  } catch (error) {
    console.error(`\n${(error as Error).message}\n`);
    process.exit(1);
  }
}
