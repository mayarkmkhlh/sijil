import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { MuseSparkClient } from "./muse-spark.js";

const env = loadEnv();
const client = new MuseSparkClient({
  apiKey: env.MODEL_API_KEY,
  model: env.MUSE_SPARK_MODEL,
  baseUrl: env.MODEL_API_BASE_URL,
});
const app = createApp(client);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
