# Nomikai

A drink-counting app with leaderboards and different drinks to try. (Nomikai is Japanese for a drinking party.)

## Structure

- `web/` — Next.js frontend
- `api/` — NestJS backend (Drizzle ORM)
- `supabase/` — Supabase config and migrations

## Development

Branch flow:

1. Create a feature branch off `main` (`feat/<name>`)
2. Merge the feature branch into `dev` for testing (staging)
3. When testing is done, merge the same feature branch into `main`

CI runs lint, tests, and builds on every PR.
