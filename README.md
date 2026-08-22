# Nomikai

A drink-counting app with leaderboards and different drinks to try. (Nomikai is Japanese for a drinking party.)

## Structure

- `web/` — Next.js frontend
- `api/` — NestJS backend (Drizzle ORM)
- `supabase/` — Supabase config and migrations

## Development

Branch flow: `feat/*` → `dev` (staging/testing) → `main`. CI runs lint, tests, and builds on every PR.
