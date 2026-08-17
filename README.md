# Tether

Monorepo for Tether: an Expo React Native client + Fastify server (TypeScript) with Postgres, using npm workspaces.

## Structure

- `client/` — Expo React Native app (SDK 57, expo-router)
- `server/` — Fastify backend with WebSocket support, Drizzle ORM + Postgres
- `compose.yml` — local Postgres for development

## Prerequisites

- Node.js 24+
- Docker

## Setup

```bash
npm install
cp server/.env.example server/.env
npm run docker:up
npm run db:migrate -w server
```

## Run

Server (Fastify on `http://localhost:3000/health`):

```bash
npm run dev
```

Client (Expo dev server):

```bash
npm run start:client
# or: cd client && npx expo start
```

## DB tooling

Runs from `server/` (or via `npm run <script> -w server`):

- `npm run db:generate` — generate a migration from the schema
- `npm run db:migrate` — apply migrations
- `npm run db:studio` — open Drizzle Studio

## Docker

```bash
npm run docker:up    # docker compose up -d
npm run docker:down  # docker compose down
```

Postgres runs on `localhost:5432` (`tether` / `tether`, db `tether`).