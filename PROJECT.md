# Project: JEE OS AI-Centric Refactor

## Architecture
- Custom React Context (`StoreContext` in `src/store/index.tsx`) acts as the global state manager.
- Synced to local storage (`jee-os-state`) and Supabase database (via `src/utils/supabase/sync.ts` and `src/utils/supabase/schema.sql`).
- Chat API route: `src/app/api/chat/route.ts` streams chat completions and tool calls.
- AI Agents:
  - AI Tutor: Academic specialist (`src/app/tutor/page.tsx`)
  - AI Coach: Strategy specialist (`src/app/coach/page.tsx`)
  - Floating Copilot: OS Navigation specialist (`src/components/layout/FloatingAICopilot.tsx`)
- Testing: E2E Playwright tests in `e2e/`.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | E2E Testing Setup | Initialize test runner, define feature inventory in TEST_INFRA.md, write baseline checks | none | DONE | ef8a1858-4ab2-46f5-8422-c2956836c628 |
| 2 | Unified Memory & Profile Adaptation | Integrate page memory context, `StoreContext` changes, and Supabase integration for profile state updates | M1 | IN_PROGRESS | 55574a68-67f3-4825-a69e-beb9946fde97 |
| 3 | Tool Call Parsing & API Route | Update `/api/chat/route.ts` and UI interfaces to parse and dispatch tool markup actions | M2 | IN_PROGRESS | 55574a68-67f3-4825-a69e-beb9946fde97 |
| 4 | Agent System Prompts | Customize system prompts for Tutor, Coach, and Floating Copilot | M3 | IN_PROGRESS | 55574a68-67f3-4825-a69e-beb9946fde97 |
| 5 | Automated Error Analysis | Mistake patterns parser and auto-tagger post-test completion in `tests/page.tsx` | M2 | IN_PROGRESS | 55574a68-67f3-4825-a69e-beb9946fde97 |
| 6 | E2E Validation & Adversarial Hardening | Phase 1 (100% E2E tests pass) and Phase 2 (Adversarial testing & Forensic Audit verification) | M4, M5 | IN_PROGRESS | 55574a68-67f3-4825-a69e-beb9946fde97 |

## Interface Contracts
- Markup tools syntax:
  - `[MARK:Topic:Status]` -> Update syllabus topic status
  - `[LOG:Topic:Minutes]` -> Log study hours for topic
  - `[NAVIGATE:/path]` -> Client-side router navigation without full page reload
  - `[CREATE_TASK:Time:Title:Desc]` -> Create a task in daily planner
  - `[SCHEDULE_REVISION:Topic]` -> Schedule spaced repetition item for topic
  - `[UPDATE_PROFILE:Key:Value]` -> Update profile keys dynamically
  - `[ADD_INSIGHT:Type:Message]` -> Push insight alert cards to the dashboard
- Actions dispatcher:
  - The UI chat components or a centralized parser should intercept incoming AI tokens, detect these bracketed markup commands, and perform corresponding context dispatches and render confirmation cards.
