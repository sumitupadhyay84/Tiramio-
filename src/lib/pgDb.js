import { Pool } from 'pg';

function getDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
}

export function hasDatabase() {
  return Boolean(getDatabaseUrl());
}

export function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL (or POSTGRES_URL) is not configured.');
  }

  if (!globalThis.__dearmisuPgPool) {
    const useSsl =
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.VERCEL) ||
      !connectionString.includes('localhost');

    const pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000
    });

    pool.on('error', err => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });

    globalThis.__dearmisuPgPool = pool;
  }

  return globalThis.__dearmisuPgPool;
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}
