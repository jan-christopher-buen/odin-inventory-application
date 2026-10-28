# odin-inventory-application

A server-rendered inventory management app built with Express, EJS, and PostgreSQL, featuring category and item CRUD with validated forms.

[Live demo](https://odin-inventory-application-zfj4.onrender.com/)

## Kanto Pantry

A fictional neighborhood grocery inventory for [The Odin Project](https://www.theodinproject.com/lessons/node-path-nodejs-inventory-application). Browse categories and items, track stock, and manage product details through responsive, server-rendered forms.

- Complete category and item CRUD with field-specific validation and preserved form values.
- Unique category names and normalized uppercase SKUs.
- PHP prices stored as integer centavos and displayed with `Intl.NumberFormat`.
- Admin password confirmation for every edit and delete submission.
- Accessible labels, keyboard focus, empty states, and custom error pages.

Built with Node.js, Express 5, EJS, plain CSS, PostgreSQL, `pg`, and `express-validator`. Uses ES modules, npm, and a pinned local Prettier.

## Local setup

Requires Node.js 22.9+ (Node 24 recommended), npm, and PostgreSQL. Install dependencies:

```sh
npm ci
cp .env.example .env
```

Create dedicated databases once, if they do not already exist:

```sh
psql -h /var/run/postgresql -U jc -d postgres -Atc "SELECT datname FROM pg_database WHERE datname IN ('odin_inventory', 'odin_inventory_test')"
# Run each command only if that database is absent:
createdb -h /var/run/postgresql -U jc odin_inventory
createdb -h /var/run/postgresql -U jc odin_inventory_test
```

Adjust `.env` for your local PostgreSQL role and connection. Enter your own `ADMIN_PASSWORD` privately in that file; there is no default. Actual environment files, including `.env.hosted`, are ignored by Git.

```sh
npm run db:setup
npm run db:seed  # optional fictional groceries
npm run dev
```

Open `http://localhost:3000`. Schema setup is non-destructive and repeatable. Seeding skips existing sample SKUs and does not overwrite edits. Neither command runs during startup or builds.

## Configuration

| Variable            | Purpose                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| `PGHOST`            | Local socket directory (such as `/var/run/postgresql`) or database host             |
| `PGPORT`            | Database port, default `5432`                                                       |
| `PGUSER`            | PostgreSQL role, e.g. `jc`                                                          |
| `PGDATABASE`        | Application database, `odin_inventory` locally                                      |
| `PGPASSWORD`        | Optional password for password-based connections; omit for peer authentication      |
| `DATABASE_URL`      | Hosted PostgreSQL connection URL; takes precedence over separate connection fields  |
| `PORT`              | HTTP port, default `3000`                                                           |
| `ADMIN_PASSWORD`    | Private shared confirmation password; blank or missing disables protected mutations |
| `HOSTED_DB_HOST`    | Explicitly confirmed Neon hostname for guarded hosted setup/seed commands           |
| `TEST_DATABASE_URL` | Optional test connection, restricted to a loopback host and `odin_inventory_test`   |

For local peer authentication use the socket settings in `.env.example`. For hosted PostgreSQL use a provider-issued `DATABASE_URL` with verified TLS (for example, a URL ending in `?sslmode=verify-full`). Keep credentials in private environment configuration. Production can inject variables directly; `npm start` does not require an environment file. Schema setup is an explicit release step, separate from server startup.

## Commands

```sh
npm start             # production-compatible server
npm run dev           # native Node watch mode
npm run db:setup      # create missing tables and indexes
npm run db:seed       # optional sample data
npm run format
npm run format:check
npm test
```

Prettier formats JavaScript, CSS, JSON, and Markdown. EJS templates use consistent HTML/EJS formatting and are excluded from Prettier because no EJS plugin is installed.

Tests use Node's built-in runner and real PostgreSQL. They always use the isolated local `odin_inventory_test` database and clear its inventory tables before and after running. They never use the application `DATABASE_URL`. Do not store data you want to keep in the test database.

## Data and behavior

A category has a generated ID, a required name (1–80 characters), and an optional description (up to 500 characters). PostgreSQL enforces case-insensitive category-name uniqueness.

Each item belongs to exactly one category and has a generated ID, name (1–120 characters), description (up to 2,000 characters), unique SKU (1–40 letters, digits, hyphens, or underscores, starting with a letter or digit), price (PHP 0–9,999,999.99), and stock (0–1,000,000 whole units). Decimal price strings are parsed precisely into centavos. Database constraints enforce required values, formats, ranges, uniqueness, and relationships.

A category containing items cannot be deleted. The confirmation page links to its items so they can be moved or deleted first. A restrictive foreign key also enforces this rule if data changes during a request. No item is cascade-deleted.

Reading and creation are public. Updates and deletes require the shared admin password on every submission, are rate-limited after repeated failures, and fail closed when the password is missing from configuration. The password is never stored in PostgreSQL or repopulated into forms. This is a limited educational safeguard, not an account or authentication system.

Routes use GET for lists, details, and forms; POST for creation, editing, and deletion. Successful mutations redirect to a GET page. Controllers validate submissions, focused query functions handle parameterized SQL, and EJS partials share navigation, fields, and item lists.

## Deployment

Use a dedicated Neon Free project/database and a new Render Free Web Service. Keep other projects and their resources separate.

Create a private, gitignored `.env.hosted` with `DATABASE_URL`, `ADMIN_PASSWORD`, and `HOSTED_DB_HOST` (the hostname from the same Neon Connect dialog). The database must be named `odin_inventory`. Use the provider connection string with TLS enabled. Never commit this file.

After confirming the target, initialize it explicitly:

```sh
npm run db:setup:hosted
npm run db:seed:hosted  # optional, preserves existing sample records and edits
```

These commands verify the hostname, database name, TLS configuration, and absence of unrelated public tables before writing. They do not reset data. Do not run integration tests against the hosted database.

Configure the new Render service with Node, branch `main`, build command `npm ci`, start command `npm start`, and health check path `/`. Select the **Free** instance type. Set `NODE_ENV=production`, `DATABASE_URL`, and `ADMIN_PASSWORD` privately before the initial deployment. Render supplies `PORT`; the server binds to `0.0.0.0`. The repository pins the Node runtime in `.node-version` and trusts Render's nearest reverse proxy for rate limiting.

Schema setup and seeding remain separate release steps, never build/start commands. Free services can sleep when idle; PostgreSQL data persists independently in Neon. See the official [Render Express deployment guide](https://render.com/docs/deploy-node-express-app), [Render Free limitations](https://render.com/docs/free), and [Neon connection guide](https://neon.com/docs/connect/connect-from-any-app).

The live application runs on Render with a dedicated Neon PostgreSQL database.
