import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/app/api/uploads/**/*.ts",
        "src/data/**/*.ts",
        "src/domain/**/*.ts"
      ],
      exclude: [
        "**/*.test.ts",
        "src/data/seed.ts"
      ],
      thresholds: {
        lines: 45,
        functions: 50,
        branches: 30,
        statements: 40
      }
    }
  }
});
