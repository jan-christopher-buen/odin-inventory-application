import { pool } from '../db/pool.js'
import { setup } from './setup.js'
import { seed } from './seed.js'

try {
  const action = process.argv[2]
  const url = new URL(process.env.DATABASE_URL)
  const allowedParameters = ['sslmode', 'channel_binding', 'connect_timeout']
  if (
    !['setup', 'seed'].includes(action) ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.neon.tech') ||
    url.hostname !== process.env.HOSTED_DB_HOST ||
    url.pathname !== '/odin_inventory' ||
    !['require', 'verify-full'].includes(url.searchParams.get('sslmode')) ||
    [...url.searchParams.keys()].some((key) => !allowedParameters.includes(key))
  )
    throw new Error('Unconfirmed hosted target')

  const { rows } = await pool.query('SELECT current_database() AS name')
  if (rows[0].name !== 'odin_inventory') throw new Error('Unexpected database')
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  )
  if (
    tables.rows.some(
      ({ tablename }) => !['categories', 'items'].includes(tablename),
    )
  ) {
    throw new Error('Unrelated tables found')
  }
  await (action === 'setup' ? setup() : seed())
  console.log(
    action === 'setup'
      ? 'Hosted inventory schema ready'
      : 'Hosted sample data ready',
  )
} catch {
  console.error(
    'Hosted operation stopped. Check the dedicated database, confirmed hostname, TLS settings, and connectivity privately.',
  )
  process.exitCode = 1
} finally {
  await pool.end()
}
