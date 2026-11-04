import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../migrations");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

try {
  for (const file of files) {
    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    await pool.query(sql);
  }
  console.log("migrated");
} finally {
  await pool.end();
}
