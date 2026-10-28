import { body } from 'express-validator'
import * as db from '../db/queries.js'
export const pricePattern = /^(0|[1-9]\d{0,6})(\.\d{1,2})?$/
export function centavos(value) {
  if (!pricePattern.test(value)) throw new Error('Invalid price')
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (result > 999999999) throw new Error('Invalid price')
  return result
}
const text = (field, max, required = false) =>
  body(field)
    .custom(
      (value) =>
        typeof value === 'string' || (!required && value === undefined),
    )
    .withMessage('Enter text.')
    .bail()
    .customSanitizer((value) => value ?? '')
    .trim()
    .isLength({ min: required ? 1 : 0, max })
    .withMessage(`Use ${required ? '1' : '0'}–${max} characters.`)
export const categoryRules = [text('name', 80, true), text('description', 500)]
export const itemRules = [
  text('name', 120, true),
  text('description', 2000),
  body('sku')
    .isString()
    .bail()
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9][A-Z0-9_-]{0,39}$/)
    .withMessage(
      'Use 1–40 letters, numbers, hyphens or underscores; start with a letter or number.',
    ),
  body('price')
    .isString()
    .bail()
    .custom((v) => {
      centavos(v)
      return true
    })
    .withMessage('Enter PHP 0–9,999,999.99 with at most two decimal places.'),
  body('stock')
    .isString()
    .bail()
    .matches(/^(0|[1-9]\d{0,6})$/)
    .withMessage('Enter a whole number from 0 to 1,000,000.')
    .bail()
    .isInt({ min: 0, max: 1000000 })
    .withMessage('Enter a whole number from 0 to 1,000,000.'),
  body('category_id')
    .isString()
    .bail()
    .matches(/^[1-9]\d{0,9}$/)
    .withMessage('Choose an existing category.')
    .bail()
    .custom(async (v) => {
      if (Number(v) > 2147483647 || !(await db.category(v)))
        throw new Error('Choose an existing category.')
    }),
]
