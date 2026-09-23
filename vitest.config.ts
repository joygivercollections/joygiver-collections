import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["tests/worker/**", "node_modules/**"],
    css: true,
    // Windows image/file interaction tests can exceed the default while workers contend.
    testTimeout: 10_000,
    maxWorkers: 4,
  },
});
