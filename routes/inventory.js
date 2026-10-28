import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as c from '../controllers/inventory.js'
import * as db from '../db/queries.js'
import { categoryRules, itemRules } from '../controllers/validation.js'
export function inventoryRoutes(kind) {
  const router = Router()
  const rules = kind === 'category' ? categoryRules : itemRules
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: 'Too many failed confirmations. Please try again in 15 minutes.',
  })
  router.use((req, res, next) => {
    req.kind = kind
    next()
  })
  router.get('/', c.list)
  router.get('/new', (req, res) => c.form(req, res))
  router.post('/new', rules, c.save)
  // Validate and load each record before dispatching its specific action.
  router.param('id', async (req, res, next, id) => {
    if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647)
      return res.status(404).render('error', {
        title: 'Not found',
        message: 'That record does not exist.',
      })
    req.entity = await (kind === 'category' ? db.category(id) : db.item(id))
    if (!req.entity)
      return res.status(404).render('error', {
        title: 'Not found',
        message: 'That record does not exist.',
      })
    next()
  })
  router.get('/:id', c.detail)
  router.get('/:id/edit', (req, res) => c.form(req, res))
  router.post('/:id/edit', limiter, rules, c.save)
  router.get('/:id/delete', (req, res) => c.confirm(req, res))
  router.post('/:id/delete', limiter, c.remove)
  return router
}
