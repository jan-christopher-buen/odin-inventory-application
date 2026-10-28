CREATE TABLE IF NOT EXISTS categories (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
 description varchar(500) NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories (lower(name));
CREATE TABLE IF NOT EXISTS items (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 category_id integer NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 name varchar(120) NOT NULL CHECK (length(btrim(name)) > 0),
 description varchar(2000) NOT NULL DEFAULT '',
 sku varchar(40) NOT NULL UNIQUE CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
 price integer NOT NULL CHECK (price BETWEEN 0 AND 999999999),
 stock integer NOT NULL CHECK (stock BETWEEN 0 AND 1000000)
);
CREATE INDEX IF NOT EXISTS items_category_idx ON items(category_id);
