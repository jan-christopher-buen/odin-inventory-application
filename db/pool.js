import pg from 'pg'
export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {},
)
pool.on('error', () => console.error('Unexpected database connection error'))
