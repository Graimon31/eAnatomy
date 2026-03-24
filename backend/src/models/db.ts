import { Pool } from 'pg';

/**
 * Singleton PostgreSQL connection pool.
 * Configure via DATABASE_URL env var or individual PG* vars.
 */
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/eanatomy',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});
