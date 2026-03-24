import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "eanatomy",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "postgres",
  max: 20,
  idleTimeoutMillis: 30_000,
});
