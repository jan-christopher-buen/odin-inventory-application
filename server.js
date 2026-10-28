import { app } from './app.js'
import { pool } from './db/pool.js'
const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () =>
  console.log('Inventory server ready'),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end()
      process.exit(0)
    }),
  )
