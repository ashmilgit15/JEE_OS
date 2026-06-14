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

---

## 📋 Actionable Implementation Checklist

### 1. State Context Split (Phase 4.1)
*   **Goal**: Break the monolithic context provider in `src/store/index.tsx` to stop unnecessary re-renders of the entire app on single-value state changes.
- [ ] Create `src/store/StateContext.tsx` to hold the actual app state.
- [ ] Create `src/store/DispatchContext.tsx` to hold the stable `dispatch` function.
- [ ] Extract derived state selectors into thin hooks (e.g., `useReadiness`, `useWhatToStudyNext`, `useSyllabusState`).
- [ ] Update all page components to import from these modular contexts/hooks rather than the unified `useStore()`.
- [ ] Run vitest suites to confirm state reducers and cascade hooks remain fully functional.

### 2. API Chat Route Decomposition (Phase 5.1)
*   **Goal**: Decompose `src/app/api/chat/route.ts` (~2,030 lines) into a modular, easily maintainable structure under `src/lib/ai/`.
- [ ] Create `src/lib/ai/search.ts` to manage Tavily textbook and web searches.
- [ ] Create `src/lib/ai/deepResearch.ts` to coordinate recursive Tavily research loops.
- [ ] Create `src/lib/ai/tools.ts` to handle tool execution logic.
- [ ] Create `src/lib/ai/prompt.ts` to manage dynamic LLM context prompt compilation.
- [ ] Create `src/lib/ai/stream.ts` to manage the NDJSON stream protocol.
- [ ] Rewrite `src/app/api/chat/route.ts` to be a thin orchestrator routing incoming messages and delegating work to the new modules.
- [ ] Verify using Playwright e2e tests that AI Tutor, Coach, and Copilot streaming continue to work perfectly.

### 3. Question Bank DB Migration (Phases 6.1 & 6.2)
*   **Goal**: Move the static 789-line `src/data/questions.ts` into a database table (`questions`) to support modular loading, scalability, and coverage for all ~160 topics.
- [ ] Add the `questions` table definition to `supabase_schema.sql` (columns: `id`, `question`, `options`, `correct_answer`, `explanation`, `topic_id`, `chapter_id`, `subject`, `difficulty`, `type`).
- [ ] Write a seed script in `src/utils/supabase/seedQuestions.ts` to populate the `questions` table from `src/data/questions.ts`.
- [ ] Implement `src/app/api/questions/route.ts` to serve paginated and topic-filtered questions with SWR caching.
- [ ] Refactor client components (like `tests/page.tsx`) to fetch questions on-demand instead of bundling the static question file.
- [ ] Validate question formats (4 options, LaTeX rendering, math wrappers) in the import pipeline.

### 4. Mega-Pages Decomposition (Phase 7.1)
*   **Goal**: Break pages of >1,000 lines down into decoupled, unit-testable components.
- [ ] Extract the common chat stream and handler logic into a shared `useAIChat` hook.
- [ ] Decompose `src/app/tests/page.tsx` into:
    - `src/components/tests/QuestionCard.tsx`
    - `src/components/tests/TestResults.tsx`
    - `src/components/tests/Scratchpad.tsx`
- [ ] Decompose `src/app/tutor/page.tsx` and `src/app/coach/page.tsx` into modular chat pane, action banner, and sidebar components.
- [ ] Decompose `src/app/log/page.tsx` into list widgets, autocomplete forms, and calendar view modules.

### 5. React Server Components Migration (Phase 7.5)
*   **Goal**: Convert purely presentation-based client pages to Server Components to reduce client bundle size.
- [ ] Identify pages that are mostly static displays: `formulas`, `resources`, `profile`.
- [ ] Remove `'use client'` from those pages and implement server-side fetching using the Supabase Server Client.
- [ ] Keep interactive inputs (like forms, buttons, accordion headers) inside nested client components (islands).

### 6. Security & Hardening (Phase 8)
*   **Goal**: Secure endpoints and sanitize input/output text blocks.
- [ ] Implement Row-Level Security (RLS) policies on `topics` and `ai_memory` tables.
- [ ] Add Content Security Policy (CSP) headers inside `next.config.ts`.
- [ ] Wrap streamed LLM output in `DOMPurify` rendering to prevent potential HTML/XSS injection.

---

## 🧪 Verification Protocol

Every task executed by the agent must be verified with the following steps:
1. **Linter**: Run `npm run lint` to ensure 0 errors and 0 warnings.
2. **Type Check**: Run `npm run typecheck` to ensure no TypeScript compilation issues.
3. **Unit Tests**: Run `npm run test` (Vitest) to make sure all 65+ unit tests pass.
4. **E2E Tests**: Run `npx playwright test` (ensure local dev server is running on port 3000) to confirm all 50 Playwright e2e tests pass.
