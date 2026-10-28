import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
// Never accept an app/hosted connection for destructive integration cleanup.
if (process.env.TEST_DATABASE_URL) {
  let url
  try {
    url = new URL(process.env.TEST_DATABASE_URL)
  } catch {
    throw new Error('Tests require a valid local test database URL')
  }
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/odin_inventory_test' ||
    url.search !== ''
  )
    throw new Error('Tests require a local odin_inventory_test database')
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
} else {
  delete process.env.DATABASE_URL
  process.env.PGHOST = '/var/run/postgresql'
  process.env.PGDATABASE = 'odin_inventory_test'
  process.env.PGUSER = process.env.PGUSER || 'jc'
}
process.env.ADMIN_PASSWORD = 'integration-only-confirmation'
const { pool } = await import('../db/pool.js')
const { setup } = await import('../scripts/setup.js')
const { seed } = await import('../scripts/seed.js')
const { app } = await import('../app.js')
const { centavos } = await import('../controllers/validation.js')
let server, base
let safeToClean = false
const password = 'integration-only-confirmation'
const post = (path, values) =>
  fetch(base + path, {
    method: 'POST',
    body: new URLSearchParams(values),
    redirect: 'manual',
  })
const get = (path) => fetch(base + path)
const restart = async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
}
before(async () => {
  const { rows } = await pool.query('SELECT current_database() AS name')
  assert.equal(rows[0].name, 'odin_inventory_test')
  safeToClean = true
  await setup()
  await pool.query('TRUNCATE items, categories RESTART IDENTITY')
  await restart()
})
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  // Never clean up if the connected database failed identity verification.
  if (safeToClean)
    await pool.query('TRUNCATE items, categories RESTART IDENTITY')
  await pool.end()
})
test('precise price parsing rejects ambiguous or excessive prices', () => {
  for (const [input, expected] of [
    ['0', 0],
    ['0.01', 1],
    ['26.50', 2650],
    ['9999999.99', 999999999],
  ])
    assert.equal(centavos(input), expected)
  for (const input of [
    '1e2',
    '-1',
    '1.001',
    '1.',
    ' 1',
    '01',
    '10000000',
    'Infinity',
  ])
    assert.throws(() => centavos(input))
})
test('real PostgreSQL CRUD, validation, confirmation and persistence', async () => {
  assert.match(await (await get('/')).text(), /Your shelves start here/)
  assert.match(await (await get('/items/new')).text(), /A category comes first/)
  for (const path of [
    '/missing',
    '/items/nope',
    '/categories/0',
    '/items/2147483648',
    '/items/999',
  ])
    assert.equal((await get(path)).status, 404)
  let response = await post('/categories/new', {
    name: '',
    description: 'preserve me',
  })
  assert.equal(response.status, 422)
  assert.match(await response.text(), /preserve me/)
  assert.equal((await pool.query('SELECT * FROM categories')).rowCount, 0)
  const categoryName = "Lola’s pantry'); DROP TABLE items; --"
  response = await post('/categories/new', {
    name: categoryName,
    description: 'Line one\nLine two',
  })
  assert.equal(response.status, 303)
  const categoryPath = response.headers.get('location').split('?')[0]
  const categoryId = categoryPath.split('/').at(-1)
  assert.equal(
    (
      await post('/categories/new', {
        name: categoryName.toUpperCase(),
        description: '',
      })
    ).status,
    422,
  )
  const values = {
    name: '<script>alert(1)</script>',
    description: 'First line\nSecond line',
    category_id: categoryId,
    sku: ' rice-01 ',
    price: '26.50',
    stock: '0',
  }
  response = await post('/items/new', values)
  assert.equal(response.status, 303)
  const itemPath = response.headers.get('location').split('?')[0]
  let html = await (await get(itemPath)).text()
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /RICE-01/)
  assert.match(html, /26\.50/)
  assert.match(await (await get(categoryPath)).text(), /RICE-01/)
  assert.equal((await post('/items/new', values)).status, 422)
  for (const patch of [
    { price: '1.001' },
    { price: '-1' },
    { stock: '1.5' },
    { stock: '1000001' },
    { category_id: '9999' },
    { sku: 'bad space' },
    { description: 'x'.repeat(2001) },
  ]) {
    assert.equal(
      (await post('/items/new', { ...values, sku: 'NEW-SKU', ...patch }))
        .status,
      422,
    )
  }
  assert.equal((await pool.query('SELECT * FROM items')).rowCount, 1)
  response = await post(itemPath + '/edit', {
    ...values,
    name: 'Changed',
    admin_password: 'wrong',
  })
  assert.equal(response.status, 422)
  html = await response.text()
  assert.match(html, /Incorrect admin password/)
  assert.doesNotMatch(html, /value="wrong"/)
  assert.equal(
    (await pool.query('SELECT name FROM items')).rows[0].name,
    values.name,
  )
  delete process.env.ADMIN_PASSWORD
  assert.equal(
    (await post(itemPath + '/edit', { ...values, admin_password: password }))
      .status,
    422,
  )
  assert.equal(
    (await post(itemPath + '/delete', { admin_password: password })).status,
    422,
  )
  process.env.ADMIN_PASSWORD = password
  assert.equal(
    (await post(categoryPath + '/delete', { admin_password: password })).status,
    409,
  )
  assert.match(
    await (await get(categoryPath + '/delete')).text(),
    /This category still has items/,
  )
  await assert.rejects(
    pool.query('DELETE FROM categories WHERE id=$1', [categoryId]),
    (error) => ['23503', '23001'].includes(error.code),
  )
  response = await post('/categories/new', {
    name: 'Beverages',
    description: '',
  })
  const secondPath = response.headers.get('location').split('?')[0]
  const secondId = secondPath.split('/').at(-1)
  assert.equal(
    (
      await post(itemPath + '/edit', {
        ...values,
        name: 'Moved item',
        category_id: secondId,
        price: '9999999.99',
        stock: '1000000',
        admin_password: password,
      })
    ).status,
    303,
  )
  assert.equal(
    (
      await post(categoryPath + '/edit', {
        name: 'Fresh groceries',
        description: 'Updated',
        admin_password: password,
      })
    ).status,
    303,
  )
  assert.equal(
    (await post(categoryPath + '/delete', { admin_password: password })).status,
    303,
  )
  await restart()
  html = await (await get(itemPath)).text()
  assert.match(html, /Moved item/)
  assert.match(html, /Beverages/)
  assert.equal(
    (await post(itemPath + '/delete', { admin_password: 'wrong' })).status,
    422,
  )
  assert.equal(
    (await post(itemPath + '/delete', { admin_password: password })).status,
    303,
  )
  assert.equal((await get(itemPath)).status, 404)
  assert.equal(
    (await post(secondPath + '/delete', { admin_password: password })).status,
    303,
  )
})
test('repeatable setup and seed preserve user edits', async () => {
  await setup()
  await setup()
  await seed()
  const counts = async () =>
    (
      await pool.query(
        'SELECT (SELECT count(*) FROM categories)::int AS categories, (SELECT count(*) FROM items)::int AS items',
      )
    ).rows[0]
  const before = await counts()
  await pool.query(
    "UPDATE items SET name='User edited rice', stock=7 WHERE sku='RICE-001'",
  )
  await seed()
  assert.deepEqual(await counts(), before)
  assert.equal(
    (await pool.query("SELECT name FROM items WHERE sku='RICE-001'")).rows[0]
      .name,
    'User edited rice',
  )
})
