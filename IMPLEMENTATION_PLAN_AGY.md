# JEE OS — Autonomous Agent (AGY) Implementation Plan

This implementation plan outlines the remaining **deferred and missing core architectural features** in the JEE OS codebase, as identified in `IMPLEMENTATION_PLAN.md`. It provides actionable checklists for an autonomous agent (AGY) to implement these slices incrementally while maintaining system stability and test compliance.

---

## 🛠️ Remaining System Gaps (Deferred Refactors)

The following areas are currently missing or deferred:
1. **Phase 4.1: State Context Split**
2. **Phase 5.1: API Chat Route Decomposition**
3. **Phase 6.1 & 6.2: Question Bank Database & Content Pipeline**
4. **Phase 7.1: Mega-Pages Component Decomposition**
5. **Phase 7.5: React Server Components (RSC) Migration**
6. **Phase 8: Security, Rate Limiter & Memory Edge-Cases**
7. **Supabase Auth (Google/Gmail OAuth)**

---

## 📋 Actionable Implementation Checklist

### 1. State Context Split (Phase 4.1) — ✅ DONE (2026-06-14)
*   **Goal**: Break the monolithic context provider in `src/store/index.tsx` to stop unnecessary re-renders of the entire app on single-value state changes.
- [x] Create `src/store/DispatchContext.tsx` to hold the stable `dispatch` function (`useDispatch()`), provided by `StoreProvider` wrapping the state context. Dispatch-only consumers (`flashcards`, `formulas` card rows/forms) now subscribe here and no longer re-render on state changes.
- [x] Extract derived state selectors into thin hooks in `src/store/selectors.ts` (`useReadiness`, `useSubjectReadiness`, `useWhatToStudyNext`, `useSyllabusState`), re-exported from the `@/store` barrel.
- [x] `useStore()` retained as a backward-compatible facade so the other 19 consumers are untouched (a separate `StateContext.tsx` file was unnecessary — the existing memoized provider already isolates state; splitting dispatch out was the actual re-render lever).
- [x] vitest (65 tests) + lint + typecheck green.

### 2. API Chat Route Decomposition (Phase 5.1) — ✅ DONE (2026-06-14)
*   **Goal**: Decompose `src/app/api/chat/route.ts` into a modular structure. (Modules live under `src/utils/ai/` to match the pre-existing convention — `deepResearch.ts`/`tools.ts`/`serverMemory.ts` were already there — rather than a parallel `src/lib/ai/`.)
- [x] `src/utils/ai/search.ts` — Tavily web + textbook search, query classifiers, and result-validation helpers (`executeTavilySearch`, `executeTextbookSearch`, `isTextbookQuery`, `buildResourceFromResult`, `TEXTBOOK_DOMAINS`, …).
- [x] `src/utils/ai/deepResearch.ts` — already present (recursive Tavily research loop).
- [x] `src/utils/ai/tools.ts` — already present (tool schemas + execution).
- [x] `src/utils/ai/prompt.ts` — `sanitizeContextBlock` (prompt-injection defense), `buildContextInjection`, and the static `TOOL_INSTRUCTIONS` contract.
- [x] `src/utils/ai/stream.ts` — `createNdjsonWriter` (idempotent close + disconnect-safe send) owning the NDJSON protocol invariants.
- [x] Route slimmed from 1,903 → 1,598 lines, delegating to the modules.
- [x] All 50 Playwright e2e pass (Tutor/Coach/Copilot routes load + stream); lint/typecheck/65 unit tests green.

### 3. Question Bank DB Migration (Phases 6.1 & 6.2) — ✅ DONE (2026-06-14)
*   **Goal**: Move the static 789-line `src/data/questions.ts` into a database table (`questions`) to support modular loading, scalability, and coverage for all ~160 topics.
- [x] `questions` table added to `supabase_schema.sql` (id, question, options[], correct_answer, explanation, topic_id, chapter_id, subject, difficulty, type) with subject/topic/chapter indexes, RLS public-read + insert-only (no update/delete → effectively locked once seeded).
- [x] `src/utils/supabase/seedQuestions.ts` — idempotent chunked upsert from `src/data/questions.ts`; wired into `initSession()` (fire-and-forget).
- [x] `src/app/api/questions/route.ts` — filtered (subject/topicId/chapterId/difficulty) + paginated (limit/offset) with `Cache-Control: s-maxage + stale-while-revalidate`; degrades to the static bank when the DB is unconfigured/unseeded.
- [x] `tests/page.tsx` `loadQuestionBank()` now fetches on-demand from `/api/questions` (paginated), falling back to the bundled bank on failure.
- [x] Import pipeline validates 4-option + valid `correctAnswer` index; malformed rows skipped with a warning.

### 4. Mega-Pages Decomposition (Phase 7.1)
### 4. Mega-Pages Decomposition (Phase 7.1) — ◑ PARTIAL: targeted high-value done (2026-06-14)
*   **Goal**: Break pages of >1,000 lines down into decoupled, unit-testable components.
*   **Scope chosen**: "targeted high-value" — the shared streaming hook + the self-contained `tests/page` pieces. Full chat-pane/banner/sidebar and log decomposition deferred (high regression risk on the most complex interactive pages, maintainability-only benefit).
- [x] Shared chat stream/handler logic: `readChatStream(response, onEvent)` added to `src/utils/streamEvents.ts` (transport = reader + UTF-8 decode + line buffering + per-line parse). The byte-identical reader loops in `tutor/page.tsx`, `coach/page.tsx`, and `FloatingAICopilot.tsx` now call it, each keeping its own `onEvent` switch (their message shapes differ). Chosen over a monolithic `useAIChat` hook because the event handling genuinely diverges per surface — extracting the transport is the real dedup without forcing a false abstraction.
- [x] Decomposed `src/app/tests/page.tsx` (1,435 → 1,082 lines) into:
    - `src/components/tests/QuestionCard.tsx` (active-question panel: badges, stem, options, nav)
    - `src/components/tests/TestResults.tsx` (score card, AI strategist diagnostic, per-question review + error classification, actions)
    - `src/components/tests/Scratchpad.tsx` (high-DPI rough-work canvas)
- [ ] DEFERRED: tutor/coach chat-pane/banner/sidebar split, and log list/autocomplete/calendar split.
- [x] Verified: lint + typecheck clean, 65 unit tests pass, build green, 48/48 e2e pass (serial; the parallel runner is flakily contended on the shared dev server — different unrelated tests fail per run and all pass standalone).

### 5. React Server Components Migration (Phase 7.5) — ❌ NOT VIABLE AS WRITTEN (assessed 2026-06-14)
*   **Goal**: Convert purely presentation-based client pages to Server Components to reduce client bundle size.
*   **Finding**: The three candidate pages are **not** "purely presentation-based" — they are fully client-state driven. There is no server-side data source to fetch from; all of their content lives in the client-side, `localStorage`-backed store:
    - `formulas/page.tsx` (563 lines) — reads/writes `state.formulaCards` via `useStore`/`useDispatch`; add/delete forms mutate the store.
    - `resources/page.tsx` (751 lines) — reads `state.resources`; also instantiates the client-only `MemoryStore` and exports `retrieveRelevantChunks` consumed by the chat RAG path.
    - `profile/page.tsx` (274 lines) — reads/writes `state.profile`, streaks, goals via the store.
*   **Why skipped**: Removing `'use client'` and fetching server-side would require migrating app state off `localStorage` onto Supabase as the source of truth — a core re-architecture that contradicts the app's offline-first design and was explicitly out of scope. A cosmetic "static shell + client island" split was considered but rejected: it adds wrapper complexity while the meaningful interactive bundle (store + handlers) stays on the client, so it yields no real bundle reduction.
*   **Decision**: Skipped by design. Revisit only if/when app state is moved to a server-authoritative model.

### 6. Security & Hardening (Phase 8) — ✅ DONE (2026-06-14)
*   **Goal**: Secure endpoints and sanitize input/output text blocks.
- [x] RLS on `topics` (public read, insert-only) and `ai_memory` (`auth.uid() = user_id`) already in `supabase_schema.sql`; `questions` table added with the same read-only-reference pattern.
- [x] CSP + full security-header suite (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) in `next.config.ts`; `connect-src` restricted to Supabase/HackClub/Tavily.
- [x] Streamed LLM output is XSS-safe: non-math text renders as React children (auto-escaped); math source is DOMPurify-sanitized before KaTeX in tutor/copilot (`src/utils/rendering.tsx`). Note: KaTeX renders LaTeX (not HTML), so even `$<img onerror=…>$` becomes escaped text — enabling DOMPurify on coach's math *source* was intentionally skipped because it corrupts legitimate inequalities (`x < y`).

### 7. Supabase Auth (Google/Gmail OAuth) — ✅ DONE (2026-06-14, code) / ⚠️ dashboard step is user-only
*   **Goal**: Enable users to sign in with their Google/Gmail account so their data is securely persisted in the cloud and accessible from any device, while successfully migrating existing local/anonymous data.
- [ ] **(USER STEP)** Configure the Google OAuth Provider in the Supabase Dashboard (client credentials + callback URL `https://<project-id>.supabase.co/auth/v1/callback`). Also enable Anonymous sign-ins and Manual Linking (used by the in-place upgrade path). Cannot be automated from code.
- [x] `src/components/auth/AuthModal.tsx` — "Continue with Google" modal (inline Google glyph for CSP), plus `src/components/auth/useAuth.ts` hook and `src/utils/supabase/auth.ts` helpers (`signInWithGoogle`, `signOut`, `getAuthUser`, `onAuthChange`).
- [x] `src/app/auth/callback/route.ts` — PKCE code→session exchange, then redirect back into the app.
- [x] Session migration in `src/utils/supabase/auth.ts` + `sync.ts`: anonymous users are upgraded **in place** via `linkIdentity({ provider: 'google' })` — the user id is preserved so all existing rows keep their owner (no data movement). Full-OAuth fallback (different uid) relies on the store's local→server `flushSync` to repopulate; `initSession()` reconciles `jee-os-device-id` to the live session uid.
- [x] `src/components/auth/SidebarAccount.tsx` rendered in `Sidebar.tsx` — shows avatar / name / email + "Sign out" when signed in, or a "Sign in" button (opens AuthModal) for anonymous users; collapse-aware.
- [x] Sign-out handler calls `supabase.auth.signOut()`, clears `jee-os-device-id`, and reloads so a fresh anonymous session starts.
- [x] `src/proxy.ts` → `utils/supabase/middleware.ts` already refreshes/validates any session (incl. Google) via `auth.getUser()`; `/auth/callback` passes through cleanly.

---

## 🧪 Verification Protocol

Every task executed by the agent must be verified with the following steps:
1. **Linter**: Run `npm run lint` to ensure 0 errors and 0 warnings.
2. **Type Check**: Run `npm run typecheck` to ensure no TypeScript compilation issues.
3. **Unit Tests**: Run `npm run test` (Vitest) to make sure all 65+ unit tests pass.
4. **E2E Tests**: Run `npx playwright test` (ensure local dev server is running on port 3000) to confirm all 50 Playwright e2e tests pass.
