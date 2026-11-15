const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.warn('⚠️ DATABASE_URL (or POSTGRES_URL) is not set. Database queries will fail until configured.');
}

const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://localhost:5432/tiramio',
  ssl: process.env.NODE_ENV === 'production' || (databaseUrl && !databaseUrl.includes('localhost'))
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));

module.exports = { pool };
