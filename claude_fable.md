# JEE OS — Codebase Improvement Report

Analysis of the codebase by Claude Fable 5 (2026-06-12). Findings are prioritized; each cites the file(s) involved. Severity = impact × likelihood, Effort = rough implementation cost.

---

## Top 10 at a Glance

| # | Improvement | Severity | Effort |
|---|------------|----------|--------|
| 1 | Extract the in-flight ordinal-matching code duplicated across 3 files | Critical | Low |
| 2 | Harden the `/api/chat` input schema and prompt-context injection | Critical | Low–Medium |
| 3 | Tighten Supabase RLS (open `topics` upsert) and middleware error handling | High | Low |
| 4 | Split the single rate-limit bucket by request type in `/api/chat` | High | Low |
| 5 | Add a selector pattern + memoized context value to the store | High | Medium |
| 6 | Add error handling / merge strategy to the Supabase sync pipeline | High | Medium |
| 7 | Deduplicate AI-chat logic (`renderInlineMath`, `parseStreamEvents`) across 4 files | High | Medium |
| 8 | Decompose the 6 page components over 850 lines | Medium | High |
| 9 | Add `loading.tsx` / `error.tsx` boundaries (currently only `not-found.tsx` exists) | Medium | Low |
| 10 | Add unit tests for the store reducer and chat-route helpers | Medium | Medium |

---

## 1. Critical — Fix Before Committing In-Flight Work

### 1.1 Ordinal topic-matching is copy-pasted in 3 places
The uncommitted changes add the same ~54-line ordinal matching block ("first topic of Mechanics") to:
- `src/app/api/chat/route.ts`
- `src/app/log/page.tsx`
- `src/utils/handleStoreAction.ts`

**Fix:** Extract to a shared `src/utils/topicMatcher.ts` (topic lookup + ordinal support) and import it in all three places before committing. This also gives you a single place to unit-test the matching logic.

### 1.2 `/api/chat` input validation uses `.passthrough()`
`src/app/api/chat/route.ts` (~line 720): the Zod `ChatSchema` ends with `.passthrough()`, allowing arbitrary extra fields into the handler. Replace with a strict schema that whitelists exactly the fields used.

### 1.3 Untrusted context concatenated into the system prompt
`src/app/api/chat/route.ts` (~lines 979–1024): `memoryContext`, `pageContent`, and `ragContext` are interpolated verbatim into the system prompt. A crafted page/memory string can override instructions (prompt injection). Wrap untrusted context in clearly delimited blocks (e.g., fenced with a note that contents are data, not instructions) and strip/neutralize role-like markers before insertion.

---

## 2. High — Security & Data Integrity

### 2.1 RLS: anyone can upsert into `topics`
`supabase_schema.sql` (~lines 44–50): the `topics` table has "Anyone can read" **and** "Anyone can upsert" policies. Any anonymous user can poison the shared syllabus topic list. Restrict writes (e.g., service role only, or drop the upsert policy and seed server-side).

### 2.2 Middleware ignores `getUser()` result
`src/utils/supabase/middleware.ts` (~line 35): `await supabase.auth.getUser()` is called but the error/result is discarded, so invalid sessions pass through silently and fail later at the RLS layer with confusing errors. Check the result and handle the failure path explicitly.

### 2.3 One rate-limit bucket for everything
`src/app/api/chat/route.ts` (lines 14–17): a single 30 req/min/IP limit covers chat, web search, mock-test generation, and deep research. Expensive operations (Tavily searches, LLM calls) deserve tighter, separate limits — both to prevent one feature from starving the others and to cap third-party API costs.

### 2.4 Sync pipeline: fire-and-forget with last-write-wins
`src/store/index.tsx` (~lines 1228–1247): the debounced sync fires 6 async calls with no `await`, no `.catch()`, and no ordering. `sync.ts` upserts are last-write-wins with no timestamp comparison, and the load-time merge strategy is inconsistent (topic status loads only when `!localState`, while logs/revisions always merge).
**Fixes:**
- Wrap the 6 calls in `Promise.allSettled` and surface failures (at minimum a retry-with-backoff).
- Add an `updated_at` comparison so a stale remote row can't clobber newer local edits.
- Standardize one merge strategy across all data types.

### 2.5 Dead sync code: `syncTopicEvents`, `syncConversation`, `loadTopicEvents`/`loadConversation`
Defined in `src/utils/supabase/sync.ts` (~lines 505–595) but never called anywhere. Either wire them in (topic events and AI conversations currently don't persist across sessions) or delete them.

### 2.6 Secrets hygiene in errors/logs
`src/app/api/chat/route.ts`: several error paths interpolate upstream response details into thrown errors and `console.warn`s. Log status codes only, never response bodies or headers from authenticated upstream calls.

---

## 3. High — State Management & Performance

### 3.1 Monolithic store context with no selectors (2,355 lines)
`src/store/index.tsx`:
- The context value (lines ~2307–2342) is recreated on every render — not wrapped in `useMemo` — so **every** consumer re-renders on **any** state change.
- ~18 heavy derived computations (`generateInsights`, `getReadinessScore`, `getRankTrajectories`, `getWhatToStudyNext`, lines 1249–2306) re-run frequently; `generateInsights` is effectively O(topics × revisions).
- Zero `React.memo` usage across all 22 app files.

**Fixes, in order of payoff:**
1. Wrap the context value in `useMemo`.
2. Split into two contexts: one for `state`, one for `dispatch` + stable helpers (dispatch never changes, so most action-only consumers stop re-rendering).
3. Memoize expensive derived values (`useMemo` keyed on the slices they read) or introduce per-domain selector hooks.
4. Longer-term: split into domain stores (syllabus / logs / insights).

### 3.2 localStorage persistence has no versioning and lossy truncation
`src/store/index.tsx` (~lines 1184–1225): no schema version key (shape changes will break old clients silently), and the quota fallback silently slices `studyLogs.slice(-100)` etc. — permanent data loss with no user notification. Add a `version` field + migration step, and notify the user (or push to Supabase first) before truncating.

### 3.3 44 KB of static data in the shared bundle
`src/data/syllabus.ts` (16 KB) is imported by the store — so it ships on every page — and `src/data/questions.ts` (28 KB) is imported by `tests/page.tsx`. Lazy-load the question bank on the tests page; consider serving syllabus from an API route or dynamic import.

### 3.4 The chat route duplicates the syllabus
`src/app/api/chat/route.ts` (~lines 93–250) embeds its own ~150-line `SYLLABUS_TOPICS` array duplicating `src/data/syllabus.ts`. Import from the data module instead — right now a syllabus update requires editing two files.

---

## 4. Medium — Architecture & Maintainability

### 4.1 Duplicated AI-chat plumbing across 4 files
- `renderInlineMath()` is defined 4× (`tutor/page.tsx`, `tests/page.tsx`, `coach/page.tsx`, `FloatingAICopilot.tsx`).
- `parseStreamEvents()` is defined 3× (tutor, coach, FloatingAICopilot).
- `quickPrompts` constants duplicated between tutor and FloatingAICopilot.
- `FloatingAICopilot.tsx` imports `FunctionGraph` and `extractGraphReferences` **from `tutor/page.tsx`** — a layout component depending on a page export.

**Fix:** Create `src/hooks/useAIChat.ts` (streaming + event parsing), `src/utils/rendering.ts` (math/markdown rendering), and `src/components/math/FunctionGraph.tsx`. Tutor, coach, and the copilot become thin consumers.

### 4.2 Six pages exceed 850 lines
`tutor` (1,512), `tests` (1,420), `log` (1,131), `coach` (1,117), `analytics` (1,063), `advanced` (886). Natural extraction seams: chat interface, scratchpad canvas, question card, chart compositions. Do this opportunistically as you touch each page — pairs well with 4.1.

### 4.3 The chat route itself (2,029 lines)
Beyond the syllabus duplication, the route mixes query classification, tool execution, fallback logic (`runSmartFallback` alone is ~548 lines), and persistence. Extract `queryClassifier.ts`, `questionGenerator.ts`, and the fallback into modules under `src/utils/` — keeps the route as orchestration only and makes the helpers unit-testable.

### 4.4 Streaming edge cases
`src/app/api/chat/route.ts`: potential double-`controller.close()` between the happy path and the catch block; the 55 s timeout has no cleanup if it fires mid-stream; if both the LLM and the fallback fail, the client can hang waiting for an end marker. Wrap the stream body in `try/finally` and guarantee a terminal event is always emitted.

### 4.5 Every page is a client component
All 18 `page.tsx` files start with `'use client'`. Interactive pages (tutor, tests, flashcards) legitimately need it; display-heavy pages (formulas, resources, profile) could become server components with client islands. Lower priority given the store-context architecture, but worth doing alongside 3.1.

---

## 5. Medium — Quality Gaps

### 5.1 No loading/error boundaries
Only `src/app/not-found.tsx` exists. Add a root `loading.tsx` and `error.tsx`, plus per-route ones for the heavy pages (tutor, tests, analytics). Cheap win for perceived quality.

### 5.2 No unit tests
Only Playwright e2e (7 specs, ~1,350 lines). The 2,355-line reducer and the chat-route helpers (topic matching, query classification, MCQ generation) are pure functions — ideal unit-test targets. Add Vitest and start with `topicMatcher` (especially once 1.1 extracts it) and the reducer.

### 5.3 Accessibility
Roughly 2 `aria-*`/`role` attributes across the whole component library. Minimum pass: `aria-label` on icon-only buttons (Sidebar, send button, drawer toggles), `aria-live="polite"` on the streaming chat message container, focus trapping in drawers/sheets (verify what `@base-ui/react` provides out of the box).

### 5.4 Console logging
82 `console.*` statements across `src/app`. Replace with a small leveled logger (`src/utils/logger.ts`) that's silent in production, or strip debug logs before deploying.

### 5.5 Misc
- `ADD_REVISION` in the reducer doesn't append to the audit log while sibling actions do (`src/store/index.tsx` ~line 526) — inconsistent on purpose or an omission?
- `const newEvents: any[] = []` in the reducer (~line 426) should be `TopicEvent[]`.
- Verify `shadcn` and `cmdk` in `package.json` are actually used at runtime.
- No `Cache-Control` headers configured in `next.config.ts` for static data.

---

## Suggested Order of Work

1. **Now (before committing in-flight changes):** 1.1 extract `topicMatcher.ts`.
2. **Quick security pass (~1 hour):** 1.2, 1.3, 2.1, 2.2, 2.3, 2.6.
3. **Stability:** 2.4 sync error handling, 4.4 streaming `try/finally`, 3.2 localStorage versioning.
4. **Performance:** 3.1 memoize context + split state/dispatch, 3.3 lazy-load data files.
5. **Maintainability (incremental):** 4.1 shared AI-chat utilities → 4.2 page decomposition → 4.3 route split, with 5.2 unit tests added as helpers get extracted.
6. **Polish:** 5.1 boundaries, 5.3 accessibility, 5.4 logging.
