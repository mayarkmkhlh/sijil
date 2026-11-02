import { loadEnv } from "./env.js";
import { extractOrder } from "./extract.js";
import { MuseSparkClient } from "./muse-spark.js";

const env = loadEnv();
const chatDate = "2026-11-02";

const chat = `هلا، ابغى العباية السوداء مقاس M
الاسم نورة
الجوال 0550000000
الرياض، حي النرجس`;

const client = new MuseSparkClient({
  apiKey: env.MODEL_API_KEY,
  model: env.MUSE_SPARK_MODEL,
  baseUrl: env.MODEL_API_BASE_URL,
});

const outcome = await extractOrder(chat, chatDate, client);
console.log(JSON.stringify(outcome, null, 2));
if (!outcome.ok) process.exit(1);
