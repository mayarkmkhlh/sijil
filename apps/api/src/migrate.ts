import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const sqlPath = resolve(dirname(fileURLToPath(import.meta.url)), "../migrations/001_orders.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = await readFile(sqlPath, "utf8");

try {
  await pool.query(sql);
  console.log("migrated");
} finally {
  await pool.end();
}
