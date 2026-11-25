# JEE OS

AI-assisted JEE preparation workspace with syllabus mastery tracking, spaced revision, flashcards, mistake replay, mock tests, analytics, resources, peer presence, and streaming AI tutor/coach/copilot agents.

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS v4 with CSS-first theme configuration
- `@base-ui/react` component primitives
- Supabase SSR auth, Postgres persistence, and Realtime presence
- Hack Club AI proxy for streaming LLM responses
- Tavily for optional web/textbook research
- Vitest for unit tests and Playwright for E2E tests

## Local setup

Prerequisite: Node.js 22+ is recommended.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The app supports local-only mode. If Supabase variables are omitted, it should still render and use browser-local state; cloud auth/sync are disabled.

## Environment variables

```bash
# Optional for local-only mode, required for cloud sync/auth
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Optional AI features
HACKCLUB_API_KEY=
HACKCLUB_MODEL=

# Optional web/textbook research
TAVILY_API_KEY=
```

Never commit real keys.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase_schema.sql` in the Supabase SQL editor.
3. Run `supabase_seed.sql` in the SQL editor to seed shared syllabus topics and reference questions.
4. Add the project URL and publishable key to `.env.local`.

Shared `topics` and `questions` reference tables are read-only for client roles. Seed or update them only through privileged SQL migrations/service-role workflows.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Production smoke test:

```bash
npm start
curl -f http://localhost:3000/
curl -f http://localhost:3000/api/questions
```

E2E tests require the app to be running:

```bash
npm run dev
npx playwright test
```

## Architecture notes

- Global learning state lives in `src/store/index.tsx` and is persisted locally, then synchronized to Supabase when configured.
- Routine cloud synchronization is upsert-only. Remote user data is deleted only through explicit reset paths, not because stale/trimmed local state is missing rows.
- AI actions that mutate application state require user confirmation. Tutor uses its richer pending-action cards; other surfaces use a centralized confirmation guard.
- AI-generated test questions are validated before entering the test arena: exactly four distinct meaningful options, a valid answer index, and a non-placeholder explanation are required.
- Function graphing uses a restricted math parser rather than JavaScript `eval`/`new Function`.
- Revision scheduling uses the shared SM-2 implementation in `src/lib/learning`.
