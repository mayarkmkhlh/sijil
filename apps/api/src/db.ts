import { Pool } from "pg";
import "./env.js";

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
});
