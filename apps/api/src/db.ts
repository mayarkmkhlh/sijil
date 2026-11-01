import { Pool } from "pg";
import "./env.js";

// Laptop migrations use Render's External URL, which requires SSL.
// The deployed API uses the Internal URL and leaves this unset.
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false as const } : undefined;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});
