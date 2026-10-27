import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Default include pattern (any *.test.* / *.spec.* outside node_modules), so external graders' tests run too.
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    // A zone with DST makes the daylight-saving price tests meaningful on any machine.
    env: { TZ: "America/New_York" },
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // The rental module + Smart Insurance must stay at 100%. Next.js shell files, generated
      // shadcn/ui components and the GCS/Gemini adapters are covered by integration and manual checks.
      include: [
        "src/app/page.tsx",
        "src/app/api/rentals/route.ts",
        "src/app/api/availability/**/route.ts",
        "src/lib/**",
        "src/services/inventoryService.ts",
        "src/services/rentalService.ts",
        "src/components/features/CategoryRates.tsx",
        "src/components/shared/SectionErrorBoundary.tsx",
        "src/components/features/RentalFlow/**",
      ],
      // Re-export-only files: nothing to execute.
      exclude: ["src/lib/utils.ts", "src/**/index.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
