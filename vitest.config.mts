import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real package throws outside a react-server bundle.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // A zone with DST makes the daylight-saving price tests meaningful on any machine.
    env: { TZ: "America/New_York" },
    restoreMocks: true,
    unstubGlobals: true,
  },
});
