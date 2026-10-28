import { pool } from './pool.js'
export const categories = async () =>
  (
    await pool.query(
      'SELECT c.*, count(i.id)::int AS item_count FROM categories c LEFT JOIN items i ON i.category_id=c.id GROUP BY c.id ORDER BY lower(c.name), c.id',
    )
  ).rows
export const items = async (categoryId = null) =>
  (
    await pool.query(
      'SELECT i.*, c.name AS category_name FROM items i JOIN categories c ON c.id=i.category_id WHERE ($1::integer IS NULL OR i.category_id=$1) ORDER BY lower(i.name), i.id',
      [categoryId],
    )
  ).rows
export const category = async (id) =>
  (await pool.query('SELECT * FROM categories WHERE id=$1', [id])).rows[0]
export const item = async (id) =>
  (
    await pool.query(
      'SELECT i.*, c.name AS category_name FROM items i JOIN categories c ON c.id=i.category_id WHERE i.id=$1',
      [id],
    )
  ).rows[0]
export async function saveCategory(id, v) {
  return (
    await pool.query(
      id
        ? 'UPDATE categories SET name=$1,description=$2 WHERE id=$3 RETURNING id'
        : 'INSERT INTO categories(name,description) VALUES ($1,$2) RETURNING id',
      id ? [v.name, v.description, id] : [v.name, v.description],
    )
  ).rows[0]
}
export async function saveItem(id, v) {
  const values = [v.category_id, v.name, v.description, v.sku, v.price, v.stock]
  return (
    await pool.query(
      id
        ? 'UPDATE items SET category_id=$1,name=$2,description=$3,sku=$4,price=$5,stock=$6 WHERE id=$7 RETURNING id'
        : 'INSERT INTO items(category_id,name,description,sku,price,stock) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      id ? [...values, id] : values,
    )
  ).rows[0]
}
export const deleteCategory = (id) =>
  pool.query('DELETE FROM categories WHERE id=$1', [id])
export const deleteItem = (id) =>
  pool.query('DELETE FROM items WHERE id=$1', [id])
