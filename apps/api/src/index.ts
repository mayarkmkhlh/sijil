import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { OrderSchema, deriveMissingFields } from "@sijil/shared";
import { loadEnv } from "./env.js";

const env = loadEnv();
const app = new Hono();
const allowedOrigins = ["http://localhost:5173", process.env.WEB_ORIGIN].filter(
  (origin): origin is string => Boolean(origin),
);

app.use(
  "/api/*",
  cors({
    origin: allowedOrigins,
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    museSparkModel: env.MUSE_SPARK_MODEL,
    modelApiConfigured: env.modelApiConfigured,
  }),
);

// Confirms the shared order schema is wired. Real extraction comes next.
app.post("/api/orders/preview", async (c) => {
  const body: unknown = await c.req.json();
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      422,
    );
  }
  const missing = deriveMissingFields(parsed.data);
  return c.json({
    ok: true,
    order: { ...parsed.data, missing_fields: missing },
    missing,
  });
});

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
