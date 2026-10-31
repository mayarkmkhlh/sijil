import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
config({ path: resolve(repoRoot, ".env") });

const envSchema = z.object({
  MODEL_API_KEY: z.string().default(""),
  MODEL_API_BASE_URL: z.string().url().default("https://api.meta.ai/v1"),
  MUSE_SPARK_MODEL: z.string().min(1).default("muse-spark-1.3"),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema> & {
  modelApiConfigured: boolean;
};

export function loadEnv(): Env {
  const parsed = envSchema.parse(process.env);
  return {
    ...parsed,
    modelApiConfigured: parsed.MODEL_API_KEY.trim().length > 0,
  };
}
