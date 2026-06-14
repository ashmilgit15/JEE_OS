# JEE OS — Implementation Plan

> Comprehensive plan to improve all aspects and core logic of the app.
> Authored by Claude Fable 5 (2026-06-13), grounded in a 17-agent parallel
> subsystem analysis with adversarial verification of every critical/high
> correctness, security, and data-model finding, plus independent code reading.
>
> **Legend** — Effort: S (<½ day) · M (1–2 days) · L (3–5 days) · XL (1–2+ weeks).
> Risk = chance of regression. ✅ = adversarially verified as a genuine problem.

---

## ✅ Implementation status (updated 2026-06-14)

**Phases 0–3, 8 wins, and the contained slices of Phases 4–7 are implemented and
verified** (lint clean · `tsc` clean · **65 unit tests pass** · production build
passes · all **50 Playwright e2e pass**). The truly-XL refactors remain
**deferred**: full state-context split (4.1), full AI-route file split (5.1),
question-bank→DB migration + content pipeline (6.1/6.2), mega-page decomposition
(7.1), and server-component migration (7.5). Each is multi-week and was scoped
out to keep the app stable.

**What landed**
- **Phase 0** — ROI weightage table re-keyed to real chapter ids (was dead);
  prerequisite/ROI topic-id drift fixed; the three competing memory formulas
  unified. All guarded by a syllabus-integrity unit test.
- **Phase 1** — `src/lib/learning/` pure engine + **Vitest**;
  `src/lib/env.ts` env validation + `.env.example`; GitHub Actions CI;
  `src/lib/observability.ts` error seam; **durable Supabase-backed rate limiter**
  with in-memory fallback.
- **Phase 2** — `topicEvents` now synced + loaded; sync flushes on tab
  hide/close; unified `flushSync`.
- **Phase 3** — FSRS-lite memory model (`memory.ts`), shared SM-2 (`sm2.ts`),
  grounded percentile curve + recency-weighted projection + data-driven rank
  trajectory (`scoring.ts` + `data/jee-percentiles.ts`), externalized readiness
  weights (`config.ts`).
- **Phase 4 (contained)** — normalized O(1) memoized topic-lookup `Map`
  replacing the O(n) triple-nested scan in `getTopicById` (4.2). Full context
  split (4.1) deferred.
- **Phase 5 (contained)** — **typed `ChatEvent` discriminated union** for the
  stream protocol (5.3); **real Supabase-backed server memory**
  (`ServerMemoryStore` + `ai_memory` table) replacing the dead localStorage
  stub (5.2); `MemoryLike` interface decoupling tools/deep-research; tool-call
  errors routed through observability (5.6). Full route split (5.1) deferred.
- **Phase 6 (contained)** — data-driven `MARKING_SCHEME` wired into test scoring
  in both score paths (6.5); taxonomy metadata fields already present on types.
  Question-bank→DB (6.1/6.2) deferred.
- **Phase 7 (contained)** — centralized subject design tokens
  (`src/lib/design/subjects.ts`, 7.2); **per-route `loading.tsx`/`error.tsx`**
  for 9 heavy routes via shared `RouteLoading`/`RouteError` (7.3); accessibility
  pass adding `aria-label`/`aria-hidden` to icon-only buttons across
  tutor/coach/tests/peers/resources (7.4). Mega-page decomposition (7.1) and
  server components (7.5) deferred.
- **Phase 8 (wins)** — CSP header; removed unused `cmdk` + `command.tsx`;
  `shadcn` moved to devDependencies.

New modules since the last pass: `src/types/chatEvents.ts`,
`src/utils/ai/{memoryTypes,serverMemory}.ts`, `src/lib/design/subjects.ts`,
`src/components/layout/{RouteLoading,RouteError}.tsx`, 18 per-route
loading/error files, plus `ai_memory` table in `supabase_schema.sql`.

**Deploy note:** re-run `supabase_schema.sql` to create the `ai_memory` and
`rate_limits` tables/functions — until then server memory and durable rate
limiting transparently fall back (no-op memory / in-memory limiter).

---


## How this plan is sequenced

The phases are ordered by **dependency and leverage**, not by subsystem:

1. **Phase 0** fixes silent correctness bugs where features *literally do not run* — cheapest, highest-trust wins.
2. **Phase 1** builds the safety net (tests, CI, env validation, observability) so every later refactor is verifiable. **Do not start Phases 3–7 before this.**
3. **Phase 2** stabilizes data/sync so we don't lose user data while we churn.
4. **Phase 3** is the **core-logic overhaul** (the pedagogical brain) — the heart of the user's request.
5. **Phases 4–7** are the larger architectural refactors (state, AI, content, UI), each safe to do once the test net exists.
6. **Phase 8** is security/hardening, runnable largely in parallel.

A one-glance roadmap is at the bottom.

---

## Phase 0 — Silent Core-Logic Bugs (do first)

These are not "improvements" — they are features that silently return wrong/default values today. Small, isolated, high-trust.

### 0.1 — ROI engine's JEE-weightage table is dead code ✅(self-verified)
- **Where:** `src/store/index.tsx:2168` `getDailyROIEngineTasks`.
- **Bug:** `weightageTable` is keyed by **topic IDs** (`phy-mech-newton`, `chem-org-aldehydes`) but looked up by **chapter ID** — `const baseWeight = weightageTable[ch.id] || 3.0` (line 2200). Chapter IDs are `phy-mechanics`, `math-calculus`, etc., so **every lookup falls through to `3.0`**. The entire "high-yield topic" prioritization never runs.
- **Fix:** Move weightage into the syllabus data as a per-chapter (or per-topic) field, or re-key the table to real chapter IDs. Long-term, fold into the data-driven taxonomy (Phase 6.3). **Effort S, Risk low.**

### 0.2 — Prerequisite-gap & ROI engines reference non-existent topic IDs ✅(self-verified)
- **Where:** `src/store/index.tsx:2271` `getPrerequisiteGaps` (and the same class of IDs in 0.1).
- **Bug:** Hardcoded IDs drifted out of sync with the syllabus during a past refactor. Confirmed dead IDs: `chem-electrochemistry-cells` (real: `chem-echem-cells`), `chem-equilibrium-ionic` (`chem-eq-ionic`), `chem-organic-basic` (`chem-org-goc`), `phy-modern-semiconductor` (`phy-mod-semiconductor`). `getTopicById` returns `null` → those dependency edges silently never fire.
- **Fix:** Correct the IDs now; then add a **build-time integrity test** (Phase 1.1) asserting every ID referenced in store engines exists in `defaultSyllabus`, so this can never silently rot again. **Effort S, Risk low.**

### 0.3 — Two contradictory memory-strength models ✅(self-verified + agent-flagged)
- **Where:** `getTopicForgettingProbability` (`src/store/index.tsx:1547`) uses `strength = baseHalflife(2.0) · (1+conf·0.5) · 1.8^recalls · (0.5+acc) · (1+√hours)`. `SCHEDULE_REVISIONS` (`:870`) uses a *different* `strength = (0.5+conf/5·1.5) · 1.5^recalls · (0.3+acc/100·1.2) · (1+√hours·0.3)`.
- **Problem:** The "how likely to forget" display and the "when to schedule next revision" logic disagree about how memory works — different bases, different recall multipliers (1.8 vs 1.5). Plus `COMPLETE_REVISION` (`:557`) runs a *third* scheme (textbook SM-2 with `q`-quality). Three models, one concept.
- **Fix:** Defer the real unification to **Phase 3.1** (single FSRS-lite memory model). For Phase 0, just document the discrepancy with a code comment and a failing test marker so it isn't "fixed" piecemeal. **Effort S, Risk low.**

### 0.4 — Stale closures in engine `useCallback` deps ✅(agent-flagged, medium)
- **Where:** several engine fns; e.g. `getTopicForgettingProbability` deps `[state.revisions, state.studyLogs, getTopicById]` but reads `info.topic.confidence/accuracy` from syllabus via `getTopicById` (whose dep is `state.syllabus`) — chain is OK, but `logStudy`/`completeTopicWithRevisions` (`:1781`, `:1833`) dispatch without awaiting and re-read stale `getTopicById`.
- **Fix:** Audit dependency arrays; where an engine reads `state.syllabus` indirectly, include it. Covered more durably by the selector refactor (Phase 4). **Effort S, Risk low.**

---

## Phase 1 — Safety Net & Foundations (gate for all big refactors)

No unit-test runner exists; the 2,436-line store and 1,913-line chat route are untested. Build this before refactoring core logic.

### 1.1 — Add Vitest + first high-value unit tests ✅(verified high)
- Install `vitest` + `@vitest/ui`; add `"test": "vitest"`, `"test:run": "vitest run"`.
- First suites (pure functions, no DOM):
  - **Store reducer** (`src/store/index.tsx`): `UPDATE_TOPIC_STATUS` cascade, `ADD_STUDY_LOG`, `COMPLETE_REVISION` SM-2 math, `SCHEDULE_REVISIONS`, `ADD_TEST_ATTEMPT` (mistakes/topicEvents fan-out).
  - **Engine fns** extracted as pure helpers (see 3.x): readiness, forgetting probability, percentile mapping.
  - **`src/utils/topicMatcher.ts`** (already pure from prior work).
  - **Syllabus integrity test** (enables 0.2): every engine-referenced topic/chapter ID ∈ `defaultSyllabus`.
- **Effort L, Risk low.** Unblocks Phases 3–7.

### 1.2 — Environment schema validation ✅(verified medium)
- Add `src/lib/env.ts` exporting a Zod-validated config object; replace direct `process.env` reads in `api/chat/route.ts` (~`:595`), supabase clients, `middleware.ts`.
- Add `.env.example` documenting all vars; log a clear warning (not crash) when optional keys (`TAVILY_API_KEY`, `HACKCLUB_API_KEY`) are absent. **Effort M, Risk low.**

### 1.3 — CI pipeline ✅(high)
- `.github/workflows/ci.yml`: install → `lint` → `test:run` → `tsc --noEmit` → `build` → (optional) Playwright against a started dev server. Add `npm audit` (non-blocking). **Effort M, Risk low.**

### 1.4 — Error tracking / observability ✅(high)
- Integrate Sentry (`@sentry/nextjs`); wrap the chat-route catch blocks and the new route modules; capture stream failures. Replace silent `console.warn`-only failures in `sync.ts`. **Effort M, Risk low.**

### 1.5 — Durable rate limiter ✅(verified high)
- **Problem:** `src/utils/rate-limit.ts` uses a module-level `Map` — resets on every serverless cold start, so the per-IP/per-type limits added previously are bypassable and offer no cost protection for paid Tavily/HackClub calls.
- **Fix:** Add a `rate_limits` table + atomic `check_rate_limit(limiter_key, limit, interval_secs)` SQL function (UPSERT-increment-compare); call it from the route. Keep the in-memory path as a fast local fallback for dev. **Effort M, Risk medium** (touches the hot path — cover with a test).

---

## Phase 2 — Data & Sync Integrity

Prevent data loss before we churn the store. Builds on prior `Promise.allSettled` sync + localStorage versioning.

### 2.1 — Sync the entities that are silently dropped ✅(verified high)
- **Problem:** `topicEvents` and AI `conversations` are generated/loaded but **never synced** (`sync.ts` has `syncTopicEvents`/`syncConversation` defined but uncalled); `flashcards`, `formulaCards`, `insights`, `dailyPlans` are also local-only. On a new device, these vanish.
- **Fix:** Wire the missing sync calls into the debounced sync effect and the load path; add tables/columns where absent (schema already has `topic_events`, `ai_conversations`). **Effort M (S for the two already-defined fns), Risk medium.**

### 2.2 — Conflict resolution instead of last-write-wins ✅(verified high)
- **Problem:** Upserts are last-write-wins with no `updated_at` comparison; an offline edit can be clobbered by a stale remote row, and the load-time merge is inconsistent (topic status only merges when `!localState`, while logs always append).
- **Fix:** Add `updated_at` to synced rows; merge by newest timestamp per entity; make the load-merge strategy uniform across all entity types. Document the model. **Effort L, Risk high** — gate behind 1.1 tests for the merge function.

### 2.3 — Flush pending sync on unload
- **Problem:** 2.5 s debounce drops the last edit if the tab closes within the window.
- **Fix:** `visibilitychange`/`pagehide` handler that flushes via `navigator.sendBeacon` or a synchronous final write. **Effort S, Risk low.**

### 2.4 — Schema/type drift + migration framework
- Reconcile the denormalized in-memory `Topic` (status/confidence/accuracy) vs normalized `topics` + `user_topic_status` tables; document the mapping in one module. Promote the existing `STATE_SCHEMA_VERSION` stub into a real ordered-migration runner. **Effort M, Risk medium.**

---

## Phase 3 — Core Learning Algorithm Overhaul (the pedagogical brain)

This is the center of the request. Today the algorithms are plausible-looking but ad-hoc, partly contradictory (Phase 0.3), and partly decorative. Extract them into a pure, tested `src/lib/learning/` module and ground them.

### 3.1 — Unify on one memory model (FSRS-lite) ✅(verified, resolves 0.3)
- Replace the three competing schemes with a single retrievability model `R = (1 + t/(F·S))^(-1)` (FSRS-style power-law) or a documented exponential, with **one** strength `S` updated by review outcome.
- `getTopicForgettingProbability`, `SCHEDULE_REVISIONS`, and `COMPLETE_REVISION` all consume the same `S`. Next interval = solve for target retention (e.g. 0.9). **Effort M, Risk high** — pure, fully unit-tested.

### 3.2 — Ground the JEE percentile curve ✅(verified high)
- **Where:** `getExpectedJEEPerformance` (`:1844`) hardcodes a `scoreToPercentile` lookup with no cited source, and a fixed CSE/NIT-Trichy target (`:1900`).
- **Fix:** Move the curve to versioned data (`src/data/jee-percentiles.ts`) sourced from published NTA score-vs-percentile tables, dated and per-year; make the target a user-configurable goal (college/branch). Interpolate as now but over real anchors. **Effort M, Risk medium.**

### 3.3 — Replace decorative rank trajectory ✅(agent-flagged)
- **Where:** `getRankTrajectories` (`:2136`) generates paths from `Math.sin(i*0.5)*0.1` and fixed coefficients — **not derived from the student's data**.
- **Fix:** Project from actual mock-test trend (linear/EWMA regression over `testAttempts`), with scenario bands (current pace / with-revisions / declining) computed from plan adherence and forgetting curves, not constants. **Effort L, Risk medium.**

### 3.4 — Adaptive, documented readiness weights
- **Where:** `getReadinessScore` (`:1329`) uses hardcoded 0.30/0.20/0.25/0.15/0.10 weights.
- **Fix:** Externalize weights into config; weight test accuracy by **recency and difficulty** (currently all tests equal — agent-flagged) rather than a flat mean; document the rationale. **Effort M, Risk low.**

### 3.5 — Define confidence/accuracy semantics ✅(verified medium)
- **Problem:** `confidence` (0–5) and `accuracy` (0–100) are written from many places (manual, AI marker, test engine) with no single definition; defaults like `confidence: 4, accuracy: 80` are injected on status change (`reducer :494`).
- **Fix:** Document and enforce: accuracy = derived from answered questions only; confidence = explicit user self-rating; stop fabricating defaults on status transitions. **Effort M, Risk medium.**

### 3.6 — Performance: memoize O(n²) engine passes ✅(high)
- `generateInsights` (`:1580`) calls `getTopicForgettingProbability` per-topic inside loops → O(topics × revisions); recomputed each render.
- **Fix:** After the Phase 4 selector split, memoize derived maps (forgetting probability per topic) keyed on the slices they read. **Effort L (with Phase 4), Risk medium.**

---

## Phase 4 — State Architecture

Now safe behind tests. Builds on prior context-value memoization.

### 4.1 — Split the monolithic context ✅(verified high)
- **Problem:** One 2,436-line provider exposes state + ~40 helpers; any state change re-renders every consumer.
- **Fix:** Split into `StateContext` (value) and `DispatchContext` (stable); extract engine helpers into pure functions in `src/lib/learning/` + thin selector hooks (`useReadiness`, `useWhatToStudyNext`, …) that subscribe to slices. **Effort L, Risk high.**

### 4.2 — Normalize topic lookups
- **Problem:** Nested `syllabus → chapters → topics` forces O(n) scans in `getTopicById` and every engine.
- **Fix:** Maintain a memoized `Map<topicId, {topic,chapter,subject}>` derived from syllabus; engines use O(1) lookups. **Effort M, Risk medium.**

### 4.3 — Type-safe AI action handling
- Replace string-similarity topic resolution in `handleStoreAction.ts` with the canonical matcher + typed action payloads; constrain `profile.aiPreferences` (currently unconstrained `any`-ish). **Effort M, Risk medium.**

---

## Phase 5 — AI Subsystem

### 5.1 — Decompose the 1,913-line chat route ✅(high)
- Extract into modules under `src/lib/ai/`: `search/` (tavily textbook+web), `deepResearch`, `tools/` (execution), `fallback`, `prompt/` (builder), `stream/` (typed event emitter). Route becomes orchestration only. **Effort M, Risk medium.**

### 5.2 — Real server-side memory ✅(verified high)
- **Problem:** `MemoryStore` uses `localStorage`, which doesn't exist server-side; the route catches the failure and substitutes a **no-op stub** (`route.ts ~:817`) — so cross-session memory is effectively dead in production.
- **Fix:** Back memory with a Supabase table (`ai_memory`: user_id, kind, content, tags, embedding?, created_at); keep the same interface. Optionally add pgvector for semantic recall. **Effort M, Risk medium.**

### 5.3 — Typed NDJSON event protocol ✅(medium)
- Define a `ChatEvent` discriminated union in `src/types/`; emit/consume through it (tutor, coach, copilot already share `parseStreamEvents` from prior work). Catches `type: 'tex'`-style typos at compile time. **Effort S, Risk low.**

### 5.4 — Provider abstraction
- Wrap HackClub behind a `ChatProvider` interface (`stream(messages, opts)`); config-select provider/model. Removes vendor lock-in and enables test mocks. **Effort M, Risk medium.**

### 5.5 — Kill smart-fallback duplication
- The ~550-line `runSmartFallback` re-implements report/search formatting that the main path already does. Share the formatting helpers; fallback only decides *when* to use them. **Effort L, Risk medium.**

### 5.6 — Robustness
- Guard tool-call arg `JSON.parse` (malformed args currently throw mid-stream); guarantee conversation persistence (await + retry); validate/sanitize RAG chunks; unify retry/timeout strategy. **Effort M, Risk low–medium.**

---

## Phase 6 — Domain Content & Model

### 6.1 — Question bank: undersized, hardcoded ✅(verified critical)
- **Problem:** ~60 questions for ~160 topics (coverage 0.375) shipped as a hardcoded TS file; many topics have **zero** questions.
- **Fix:** Migrate to a `questions` table (indexed on topic_id/difficulty/subject); `GET /api/questions?...` with on-demand/paginated fetch + SWR cache; remove from client bundle. **Effort XL, Risk high** (data migration).

### 6.2 — Content sourcing pipeline ✅(high)
- A hardcoded bank is unmaintainable. Build an authoring/import path: structured importer for PYQs, an admin authoring UI or seed scripts, validation (4 options, one correct, LaTeX renders, has explanation). **Effort XL, Risk high.**

### 6.3 — Question quality + taxonomy metadata ✅(verified high)
- Add solution steps, error-pattern tags, difficulty calibration, `estimatedHours`, `prerequisites[]`, `relatedTopics[]`, per-chapter JEE weightage (feeds Phase 0.1 and 3). Replace string IDs with branded types / generated unions. **Effort L, Risk medium.**

### 6.4 — Syllabus completeness ✅(verified medium)
- Audit against current JEE Main/Advanced; fill missing inorganic-chemistry and JEE-Advanced-only topics. **Effort M, Risk low.**

### 6.5 — Data-driven marking scheme
- `+4/-1` is hardcoded in ≥3 places; centralize into a `markingScheme` config (supports JEE Main vs Advanced partial marking). **Effort S, Risk low.**

---

## Phase 7 — UI & Design System

### 7.1 — Decompose mega-pages ✅(verified critical)
- **Problem:** `tests` 1,405 / `tutor` 1,215 / `log` 1,102 / `analytics` 1,063 / `coach` 1,056 / `syllabus` 937 / `advanced` 886 lines — untestable, unreusable.
- **Fix (incremental, one page per PR):** extract `useAIChat` hook (tutor/coach/copilot already share render+stream utils from prior work), `Scratchpad`, `QuestionCard`, `TestResults`, chart components, log autocomplete. **Effort XL, Risk high.**

### 7.2 — Centralize the design system ✅(high)
- Subject color/label/icon maps are duplicated across 6+ pages. Extract to `src/lib/design/subjects.ts` + shared compound components (insight card, stat card, chart wrappers). **Effort M, Risk medium.**

### 7.3 — Per-route loading/error boundaries ✅(high)
- Root `loading.tsx`/`error.tsx` exist (prior work); add per-route ones for heavy pages (tutor, tests, analytics, coach). **Effort M, Risk low.**

### 7.4 — Accessibility pass ✅(verified high)
- Build on prior aria work: focus management/trapping in dialogs & drawers, keyboard nav, complete icon-button labels, verify dark-theme contrast. **Effort M, Risk low.**

### 7.5 — Server components where viable ✅(high)
- All 17 pages are `'use client'`. After 4.1, move display-heavy pages (formulas, resources, profile, parts of analytics) to server components with client islands. **Effort L, Risk medium.**

---

## Phase 8 — Security & Hardening (parallelizable)

- **8.1 — Topics RLS:** drop public INSERT; seed server-side via migration/admin endpoint. ✅ **S/medium.**
- **8.2 — CSP header** in `next.config.ts` (script/style/connect-src for KaTeX, Recharts, HackClub, Tavily, Supabase). ✅ **S/medium.**
- **8.3 — Content sanitization:** ensure all stored/streamed LLM HTML passes DOMPurify on render; sanitize user query before external API calls. ✅ **M/low.**
- **8.4 — Session model:** document anon-auth privacy model; verify JWT expiry; optional idle re-auth. **M/low.**
- **8.5 — Dependency hygiene:** remove unused `cmdk`/`shadcn` from runtime deps; schedule `npm outdated` updates; re-enable `@typescript-eslint/no-explicit-any` and burn down `any`. **S/low.**
- **8.6 — Critical-path e2e:** rate-limit 429, RLS denial, sync-failure degradation, stream interruption. **L/medium.**

---

## Roadmap at a glance

| Phase | Theme | Gates on | Headline effort |
|------|-------|----------|-----------------|
| **0** | Silent core-logic bugs | — | S ×4 |
| **1** | Tests, CI, env, observability, durable rate limit | — | L + M×4 |
| **2** | Sync integrity & conflict resolution | 1.1 | L + M×2 |
| **3** | Learning-algorithm overhaul (core logic) | 1.1 | M×4 + L×2 |
| **4** | State architecture (split + selectors) | 1.1 | L + M×2 |
| **5** | AI subsystem (modularize, real memory) | 1.1 | M×4 + L |
| **6** | Question bank → DB + content pipeline | 1.1, 2 | XL×2 + L |
| **7** | UI decomposition & design system | 4.1 | XL + L×2 |
| **8** | Security & hardening | — (parallel) | M×3 + S×3 |

**Critical path:** 0 → 1 → (2 ‖ 3 ‖ 4) → (5 ‖ 6 ‖ 7), with 8 alongside throughout.

**If you want maximum value fastest:** Phase 0 (a day, makes broken features work) → Phase 1.1 + 1.5 (safety net + close the rate-limit cost hole) → Phase 3.1–3.3 (make the "brain" honest). That trio addresses correctness, safety, and the pedagogical core — the substance of "improve core logic."

---

### Analysis provenance
68 findings from 6 specialist agents; every critical/high finding in correctness, core-logic, security, and data-model was re-checked by an independent adversarial verifier (verdicts retained inline above as ✅). Phase 0 bugs 0.1–0.3 were additionally confirmed by direct code reading (`weightageTable[ch.id]` key mismatch; dead topic IDs `chem-echem-cells` etc.; divergent strength formulas at `:1547` vs `:870`).
