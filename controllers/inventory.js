import { validationResult } from 'express-validator'
import { timingSafeEqual, createHash } from 'node:crypto'
import * as db from '../db/queries.js'
import { centavos } from './validation.js'
const plural = (kind) => (kind === 'category' ? 'categories' : 'items')
export async function list(req, res) {
  const isCategory = req.kind === 'category'
  res.render('list', {
    title: isCategory ? 'Your categories' : 'All items',
    kind: req.kind,
    records: await (isCategory ? db.categories() : db.items()),
  })
}
export async function detail(req, res) {
  res.render('detail', {
    title: req.entity.name,
    kind: req.kind,
    entity: req.entity,
    records: req.kind === 'category' ? await db.items(req.entity.id) : [],
  })
}
export async function form(req, res, errors = {}, status = 200) {
  const values =
    req.method === 'POST'
      ? Object.fromEntries(
          ['name', 'description', 'sku', 'price', 'stock', 'category_id'].map(
            (k) => [k, typeof req.body?.[k] === 'string' ? req.body[k] : ''],
          ),
        )
      : { ...req.entity }
  if (req.method !== 'POST' && req.kind === 'item' && req.entity)
    values.price = (req.entity.price / 100).toFixed(2)
  res.status(status).render('form', {
    title: `${req.entity ? 'Edit' : 'New'} ${req.kind}`,
    kind: req.kind,
    entity: req.entity,
    values,
    errors,
    categories: await db.categories(),
  })
}
function adminError(req) {
  if (!process.env.ADMIN_PASSWORD)
    return 'Admin confirmation is not configured. Updates and deletion are unavailable.'
  const hash = (v) => createHash('sha256').update(v).digest()
  if (
    typeof req.body?.admin_password !== 'string' ||
    !timingSafeEqual(
      hash(req.body.admin_password),
      hash(process.env.ADMIN_PASSWORD),
    )
  )
    return 'Incorrect admin password.'
}
export async function save(req, res) {
  const errors = Object.fromEntries(
    validationResult(req)
      .array()
      .map((e) => [e.path, e.msg]),
  )
  if (req.entity) {
    const error = adminError(req)
    if (error) errors.admin_password = error
  }
  if (Object.keys(errors).length) return form(req, res, errors, 422)
  try {
    const values = { ...req.body }
    if (req.kind === 'item') values.price = centavos(values.price)
    const record = await (req.kind === 'category'
      ? db.saveCategory(req.entity?.id, values)
      : db.saveItem(req.entity?.id, values))
    if (!record)
      return res.status(404).render('error', {
        title: 'Not found',
        message: 'This record no longer exists.',
      })
    res.redirect(303, `/${plural(req.kind)}/${record.id}?success=saved`)
  } catch (error) {
    if (error.code === '23505')
      return form(
        req,
        res,
        {
          [req.kind === 'category' ? 'name' : 'sku']:
            'This value is already in use.',
        },
        422,
      )
    if (error.code === '23503')
      return form(
        req,
        res,
        { category_id: 'This category no longer exists.' },
        422,
      )
    throw error
  }
}
export async function confirm(req, res, error = '', status = 200) {
  const records = req.kind === 'category' ? await db.items(req.entity.id) : []
  res.status(status).render('delete', {
    title: `Delete ${req.kind}`,
    kind: req.kind,
    entity: req.entity,
    records,
    error,
  })
}
export async function remove(req, res) {
  const error = adminError(req)
  if (error) return confirm(req, res, error, 422)
  try {
    await (req.kind === 'category'
      ? db.deleteCategory(req.entity.id)
      : db.deleteItem(req.entity.id))
    res.redirect(303, `/${plural(req.kind)}?success=deleted`)
  } catch (error) {
    if (['23503', '23001'].includes(error.code))
      return confirm(
        req,
        res,
        'Move or delete the items in this category first.',
        409,
      )
    throw error
  }
}
