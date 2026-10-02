import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        fileURLToPath(new URL("./migrations", import.meta.url)),
      );

      return {
        main: "./worker/index.ts",
        miniflare: {
          d1Databases: ["DB"],
          r2Buckets: ["PRODUCT_IMAGES"],
          bindings: {
            WHATSAPP_NUMBER: "2348000000000",
            ADMIN_SETUP_TOKEN: "test-setup-token",
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    include: ["tests/worker/**/*.test.ts"],
    // Bound Miniflare concurrency so individual requests are not starved on Windows hosts.
    maxWorkers: 1,
    testTimeout: 10_000,
  },
});
