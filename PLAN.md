# Plan: Issue #1 — Scaffold monorepo (Expo client + Fastify server + Postgres)

GitHub issue #1: "Scaffold monorepo: Expo client + Fastify server + Postgres"

> `client/` — Expo React Native app; `server/` — Fastify backend with WebSocket support;
> Postgres via Docker Compose for dev (managed Postgres on Railway comes later); README with setup steps.

Stack decisions:
- Monorepo tooling: **npm workspaces** (zero new tooling, matches existing `package-lock.json`, Expo SDK 57 auto-detects monorepos — no `metro.config.js` needed)
- Server language: **TypeScript**, run via `tsx` (dev) / `tsc` + `node dist` (prod)
- ORM: **Drizzle v1 (RC) with Relational Queries v2** — `drizzle-orm@rc` / `drizzle-kit@rc` (`1.0.0-rc.4`). `latest` on npm is still v0 (`0.45.2`); `@rc` matches the current docs at orm.drizzle.team (see `/docs/relations-v1-v2`, `/docs/rqb`)
- Driver: **node-postgres (`pg`)** — `drizzle-orm/node-postgres`, explicit `Pool`
- Env validation: **Zod** in `src/env.ts` (runtime-validated `process.env`)
- No `dotenv`: Node's built-in `process.loadEnvFile(path)` (Node 20.12+/21.7+; stable in v22.21+/v24.10+). Note: tsx does NOT auto-load `.env` (open feature request tsx#463) — the guarded `loadEnvFile()` call in `env.ts` covers both tsx dev and node prod with zero flags
- Versions (current): fastify `^5.12`, `@fastify/cors` `^11.3`, `@fastify/websocket` `^11.3`, `pg` `^8.23`, `@types/pg` `^8.21`, `zod` `^4.4`, `tsx` `^4.23`, `typescript` `~6.0.3`, `@types/node` `^26`

---

## 1. Repo restructure (npm workspaces)

- Move the existing Expo app into `client/`:
  - `app.json`, `assets/`, `src/`, `scripts/`, `tsconfig.json`, `package.json`
  - App code untouched; `@/*` → `./src/*` path aliases still work (tsconfig moves with it)
- New root `package.json`:
  - `private: true`, `workspaces: ["client", "server"]`
  - Scripts:
    - `dev` → `npm run dev -w server` (satisfies acceptance: `npm run dev` boots Fastify)
    - `start:client` → `npm run start -w client` (i.e. `npx expo start`)
    - `docker:up` → `docker compose up -d`, `docker:down` → `docker compose down`
    - `typecheck` → `npm run typecheck -ws --if-present`
- Delete stale root `node_modules/` + `package-lock.json`, reinstall fresh from root
- Update root `.gitignore`: add `server/.env`, `server/dist/` (keep existing entries; `drizzle/` migrations folder is committed, not ignored)

## 2. Server dependencies (`server/package.json`)

```jsonc
{
  "name": "@tether/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@fastify/cors": "^11.3.0",
    "@fastify/websocket": "^11.3.0",
    "drizzle-orm": "1.0.0-rc.4",
    "fastify": "^5.12.0",
    "pg": "^8.23.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^26.2.0",
    "@types/pg": "^8.21.0",
    "drizzle-kit": "1.0.0-rc.4",
    "tsx": "^4.23.12",
    "typescript": "~6.0.3"
  }
}
```

Note: install with `npm i drizzle-orm@rc drizzle-kit@rc` (docs migration guide pins `@rc`); pin the resolved `1.0.0-rc.4` in package.json for reproducibility.

## 3. Server structure

### `server/src/env.ts` — Zod env validation (common pattern)

```ts
import { existsSync } from 'node:fs'
import { z } from 'zod'

if (existsSync('.env')) process.loadEnvFile() // no dotenv; safe if absent (prod/Railway)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url().default('http://localhost:8081'), // Expo web dev origin
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
```

- Guarded `loadEnvFile()` works under tsx dev AND `node dist` prod; OS env vars always win
- `drizzle-kit` auto-loads top-level `.env` itself, so `drizzle.config.ts` is covered

### `server/src/db/` — Drizzle v1 + RQB v2 layout (per docs conventions)

- `schema.ts` — pg-core tables (placeholder/empty for issue #1; rooms/membership land in issues #3/#4)
- `relations.ts` — new v2 API:

```ts
import { defineRelations } from 'drizzle-orm'
import * as schema from './schema.ts'

export const relations = defineRelations(schema, (r) => ({}))
```

  Future notes: `r.one.users({ from: r.x.authorId, to: r.users.id })`, `r.many.posts()`, many-to-many via `r.users.id.through(r.usersToGroups.userId)` — a big win for issue #4 (membership junction table)

- `index.ts`:

```ts
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { env } from '../env.ts'
import { relations } from './relations.ts'

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 })
export const db = drizzle({ client: pool, relations })
```

  (v1 signature: config object with `client` + `relations`, not `{ schema }`)

### `server/src/index.ts` — Fastify app

- `fastify()`, register `@fastify/cors` (`origin: env.CORS_ORIGIN`), `@fastify/websocket`
- Decorate `db` (`app.decorate('db', db)` + `declare module 'fastify'` augmentation)
- `GET /health` → `app.db.execute('select 1')` → `200 { status: 'ok', db: 'up' }`, else `503 { status: 'degraded', db: 'down' }`
- Minimal `GET /ws` echo route proving WebSocket support (full relay is issue #6)
- `app.listen({ host: env.HOST, port: env.PORT })`

### `server/drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit'
import { env } from './src/env.ts'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
})
```

### `server/.env.example`

```
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgres://tether:tether@localhost:5432/tether
CORS_ORIGIN=http://localhost:8081
```

## 4. Docker Compose (root `docker-compose.yml`)

- `postgres:17-alpine`
- `POSTGRES_USER=tether`, `POSTGRES_PASSWORD=tether`, `POSTGRES_DB=tether`
- Port `5432:5432`, named volume for persistence
- Healthcheck: `pg_isready -U tether -d tether`

## 5. README rewrite

- Prereqs: Node 24+, Docker
- Setup: `npm install`, `cp server/.env.example server/.env`, `docker compose up -d`, `npm run db:migrate`
- Run server: `npm run dev` → `http://localhost:3000/health`
- Run client: `npm run start:client` (or `cd client && npx expo start`)
- DB tooling: `db:generate`, `db:migrate`, `db:studio`
- Note Postgres is managed on Railway later (env-driven `DATABASE_URL`)

## 6. RQB v2 API notes (from current docs, as of Aug 2026)

- `db.query.<table>.findMany/findFirst` with object-based filters:
  - `where: { id: 1 }`, `{ OR: [], AND: [], NOT: {}, RAW: (t) => sql\`...\` }`
  - per-column operators: `eq, ne, gt, gte, lt, lte, in, notIn, like, ilike, notLike, notIlike, isNull, isNotNull, arrayOverlaps, arrayContained, arrayContains`
  - relation filters: `where: { posts: { content: { like: 'M%' } } }`
- `orderBy: { id: "asc" }` (object form; callback form for raw SQL)
- `with` supports `limit`/`offset` on nested relations
- Column refs in `orderBy`/`RAW`/`extras` must go through the callback param (`(t) => sql\`${t.id}\``), never the imported table object
- `extras` for custom fields (aggregations NOT supported — use core queries)
- Prepared statements: `.prepare('name')` + `sql.placeholder()`

## 7. Verification

- `npm install` from root; `npm run typecheck -w server`
- Boot server, `curl localhost:3000/health`
- Docker is NOT installed in the current environment: verify `db: 'up'` + `docker compose up` on the user's machine (expected here: `503`, `db: 'down'`)
- Smoke-check client config: `cd client && npx expo config` (full `expo start` boot on user's machine)