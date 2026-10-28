import { readFile } from 'node:fs/promises'
import { pool } from '../db/pool.js'
export async function setup() {
  await pool.query(
    await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'),
  )
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    await setup()
    console.log('Schema ready')
  } catch {
    console.error('Schema setup failed')
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
