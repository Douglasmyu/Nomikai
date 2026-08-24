# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Nomikai — a drink-counting app with leaderboards and different drinks to try. (Nomikai is Japanese for a drinking party.) Fun side project — keep things simple.

## Structure

- `web/` — Next.js (TypeScript, App Router, Tailwind). Talks to Supabase with the publishable key (`web/.env.local`).
- `api/` — NestJS (TypeScript) with Drizzle ORM (`api/drizzle.config.ts`, schema in `api/src/db/schema.ts`). Uses the secret key / direct DB connection (`api/.env`).
- `supabase/` — Supabase CLI config, migrations (schema starts with `profiles`), and auth email templates (`templates/otp.html`; hosted free tier ignores them until custom SMTP is configured).

## Commands

- `web/`: `npm run dev` (Turbopack), `npm run build`, `npm run lint`
- `api/`: `npm run start:dev`, `npm run build`, `npm run test`
- Supabase local stack: `supabase start` / `supabase stop` / `supabase db reset` (Docker required). Studio at http://127.0.0.1:54323, API at 54321, DB at 54322.
- Drizzle: `npx drizzle-kit generate` / `npx drizzle-kit push` from `api/`

## Supabase specifics

- Hosted project ref: `zcnjovwozgsxowijebgw` (AWS us-west-2). Secrets live in root `.env` (gitignored).
- The direct connection host `db.zcnjovwozgsxowijebgw.supabase.co` is IPv6-only and unreachable from this network. Use the IPv4 session pooler instead: `aws-0-us-west-2.pooler.supabase.com:5432`, user `postgres.zcnjovwozgsxowijebgw`.
- The locally logged-in Supabase CLI account does NOT have access to this project (`supabase link` fails with a privileges error — project belongs to a different account). Use `--db-url` based commands (e.g. `supabase db push --db-url "$SUPABASE_DB_URL"`) instead of linked commands.
- npm note: `~/.npm` contains root-owned files, so plain `npm install` fails. Either fix once with `sudo chown -R 501:20 ~/.npm` or set `npm_config_cache` to a writable dir.
