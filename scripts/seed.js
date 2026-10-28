import { pool } from '../db/pool.js'
export async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [category, description, name, sku, price, stock] of [
      [
        'Pantry staples',
        'Everyday essentials for the kitchen.',
        'Sinandomeng rice · 1 kg',
        'RICE-001',
        5800,
        32,
      ],
      [
        'Fresh produce',
        'Fruit and vegetables for the neighborhood.',
        'Lakatan bananas · 1 kg',
        'FRUIT-001',
        9500,
        18,
      ],
      [
        'Canned goods',
        'Convenient cupboard favorites.',
        'Sardines in tomato sauce',
        'CAN-001',
        2650,
        48,
      ],
      [
        'Beverages',
        'Refreshments for any day.',
        'Calamansi juice · 250 ml',
        'DRINK-001',
        2200,
        24,
      ],
    ]) {
      if (
        (await client.query('SELECT 1 FROM items WHERE sku=$1', [sku])).rowCount
      )
        continue
      await client.query(
        'INSERT INTO categories(name, description) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [category, description],
      )
      await client.query(
        'INSERT INTO items(category_id,name,sku,price,stock) SELECT id,$2,$3,$4,$5 FROM categories WHERE lower(name)=lower($1) ON CONFLICT DO NOTHING',
        [category, name, sku, price, stock],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    await seed()
    console.log('Sample data ready')
  } catch {
    console.error('Seeding failed')
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
