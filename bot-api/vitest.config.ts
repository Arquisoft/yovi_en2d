import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],

      include: ["src/**/*.ts", "src/*.ts"],

      exclude: [
        "src/server.ts",
        "**/*.route.ts",
        "**/*_routes.ts",
        "vitest.config.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "node_modules",
      ],

      thresholds: {
        lines: 80,
        functions: 70,
        branches: 80,
        statements: 80,
      },
    },
  },
});