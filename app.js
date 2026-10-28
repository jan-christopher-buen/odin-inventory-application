import express from 'express'
import { fileURLToPath } from 'node:url'
import { inventoryRoutes } from './routes/inventory.js'
import * as db from './db/queries.js'
export const app = express()
app.disable('x-powered-by')
app.set('view engine', 'ejs')
app.set('views', fileURLToPath(new URL('./views', import.meta.url)))
app.use((req, res, next) => {
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  )
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'same-origin')
  res.locals.success =
    typeof req.query.success === 'string' &&
    ['saved', 'deleted'].includes(req.query.success)
      ? req.query.success
      : ''
  res.locals.money = (value) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value / 100)
  next()
})
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))))
app.use(
  express.urlencoded({ extended: false, limit: '48kb', parameterLimit: 20 }),
)
app.get('/', async (req, res) =>
  res.render('list', {
    title: 'A little order. A well-stocked store.',
    kind: 'category',
    records: await db.categories(),
    home: true,
  }),
)
app.use('/categories', inventoryRoutes('category'))
app.use('/items', inventoryRoutes('item'))
app.use((req, res) =>
  res.status(404).render('error', {
    title: 'Page not found',
    message:
      'We could not find that page. Use the navigation to return to your inventory.',
  }),
)
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const bad = error.status === 413 || error.status === 400
  console.error(bad ? 'Invalid request body' : 'Request failed')
  res.status(bad ? error.status : 500).render('error', {
    title: bad ? 'Invalid request' : 'Something went wrong',
    message: bad
      ? 'The submitted form is too large or malformed.'
      : 'Please try again later. Your inventory could not be loaded.',
  })
})
