import pg from 'pg'
export const pool = new pg.Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {}),
  connectionTimeoutMillis: 15000,
})
pool.on('error', () => console.error('Unexpected database connection error'))
