import type { Instrumentation } from "next";

/**
 * Runs once before the server accepts requests. Validates the environment and
 * aborts the process on misconfiguration so the app never serves in a broken state.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateStartup } = await import("./instrumentation-node");
    validateStartup();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import("@/lib/logger");
  logger.child("request").error("Unhandled request error", {
    error,
    digest: typeof error === "object" && error !== null && "digest" in error ? error.digest : undefined,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
