import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { OrderSchema, deriveMissingFields } from "@sijil/shared";
import { z } from "zod";
import { loadEnv } from "./env.js";
import { extractOrder, type ModelClient } from "./extract.js";
import { clientIp, createExtractGuard, extractIsEnabled } from "./extract-guard.js";
import { ModelRequestError } from "./muse-spark.js";

const extractBodySchema = z.object({
  chat: z.string().trim().min(1, "chat is required").max(8_000, "chat is too long"),
  chatDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "chatDate must be YYYY-MM-DD")
    .optional(),
});

function todayInRiyadh(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function issuesOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/** The model is passed in so tests can use a fake and production can pass Muse Spark. */
export function createApp(client: ModelClient) {
  const env = loadEnv();
  const extractGuard = createExtractGuard({
    enabled: extractIsEnabled(env.EXTRACT_ENABLED),
    ipLimit: env.EXTRACT_IP_LIMIT,
    dailyLimit: env.EXTRACT_DAILY_LIMIT,
  });
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

  app.post("/api/orders/preview", async (c) => {
    const body: unknown = await c.req.json();
    const parsed = OrderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, issues: issuesOf(parsed.error) }, 422);
    }
    const missing = deriveMissingFields(parsed.data);
    return c.json({
      ok: true,
      order: { ...parsed.data, missing_fields: missing },
      missing,
    });
  });

  app.post(
    "/api/extract",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.json({ error: "Payload too large" }, 413),
    }),
    async (c) => {
      const decision = extractGuard.allow(clientIp(c.req.header("x-forwarded-for")));
      if (!decision.ok) {
        if (decision.retryAfterSeconds !== undefined) {
          c.header("retry-after", String(decision.retryAfterSeconds));
        }
        return c.json({ error: decision.error }, decision.status);
      }

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ issues: [{ path: "", message: "Request body must be JSON" }] }, 400);
      }

      const parsed = extractBodySchema.safeParse(body);
      if (!parsed.success) return c.json({ issues: issuesOf(parsed.error) }, 400);

      const chatDate = parsed.data.chatDate ?? todayInRiyadh();
      try {
        const outcome = await extractOrder(parsed.data.chat, chatDate, client);
        if (!outcome.ok) {
          return c.json({ issues: outcome.issues, attempts: outcome.attempts }, 422);
        }
        if ("noOrder" in outcome.result) {
          return c.json({
            kind: "noOrder",
            reason: outcome.result.reason,
            attempts: outcome.attempts,
          });
        }
        return c.json({
          kind: "order",
          order: outcome.result,
          missing_fields: outcome.result.missing_fields,
          attempts: outcome.attempts,
        });
      } catch (error) {
        const upstream =
          error instanceof ModelRequestError
            ? error.status === undefined
              ? { kind: error.kind }
              : { kind: error.kind, status: error.status }
            : { kind: "network" as const };
        console.error(error instanceof Error ? error.message : "model request failed");
        return c.json({ error: "model request failed", upstream }, 502);
      }
    },
  );

  return app;
}
