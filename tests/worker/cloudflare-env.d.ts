import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      PRODUCT_IMAGES: R2Bucket;
      WHATSAPP_NUMBER: string;
      ADMIN_SETUP_TOKEN: string;
      TEST_MIGRATIONS: D1Migration[];
    }

    interface GlobalProps {
      mainModule: typeof import("../../worker/index");
    }
  }
}

export {};
