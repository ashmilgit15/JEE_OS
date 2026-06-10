# JEE OS: Deep Architectural Audit & Advanced Platform Roadmap

This document provides a comprehensive codebase audit and an actionable engineering roadmap to transform **JEE OS** into the ultimate, state-of-the-art workspace for Joint Entrance Examination (JEE) Main & Advanced aspirants. 

---

## Executive Summary

JEE OS is a single-page Next.js App Router companion designed for Indian engineering aspirants. It combines quantitative readiness tracking, spaced repetition revision schedules, and grading-oriented mock exams with an AI tutor/coach copilot. 

Our deep structural audit shows that the application foundation is modern (Next.js 16.2.7, React 19.2.4, Tailwind v4, `@base-ui/react`, Supabase SSR). However, it suffered from React 19 JSX-in-try-catch rendering violations, React Hook dependency array instabilities, and documentation misalignments. 

By resolving these issues and implementing the advanced features outlined in this blueprint—such as **Mistake Vaults**, **Adaptive SM-2 Spaced Repetition**, and **Sigmoid-based Rank Projections**—JEE OS will establish itself as the premier cognitive learning operating system for JEE preparation.

---

## Section 1: Codebase Structural & Reference Audit

We conducted a thorough codebase audit across the core directories, analyzing routing, state management, styling, and database sync.

### 1.1 App Router Routing & Structure (`src/app/`)
* **Framework Pattern**: JEE OS adheres strictly to Next.js 16 App Router structure. All routes are located in subdirectories of `src/app/` (e.g., `/tutor`, `/flashcards`, `/revisions`, `/tests`, `/formulas`, `/settings`).
* **Route Guards & Session Sync (`src/proxy.ts`)**: Next.js 16 deprecated synchronous middleware in favor of the proxy file pattern (`src/proxy.ts`). JEE OS utilizes `src/proxy.ts` correctly to intercept requests, read the session from cookies, guard private dashboard routes, and keep user sessions synchronized with the client-side state.

### 1.2 Global State Management (`src/store/index.tsx`)
* **State Engine**: The application manages state client-side using a single React Context + `useReducer` pattern. It stores user profiles, study logs, flashcards, revision schedules, and mock test histories.
* **Storage Synchronization**: Global state is persisted locally under the `jee-os-state` localStorage key. Changes are dynamically synchronized back to Supabase using a background db sync layer (`src/utils/supabase/sync.ts`).
* **Selector Memoization Gaps**: Function definitions returned from the store hook (e.g., `getPrerequisiteGaps`) were previously reconstructed on every render. This caused downstream hook dependency updates, resulting in unnecessary component re-renders (e.g., in `/syllabus` and `/revisions`). 

### 1.3 Styling & Typography Configuration
* **Tailwind v4 Configuration**: The project has transitioned to Tailwind v4, utilizing a CSS-first design. There is no `tailwind.config.js` in the root. Instead, design tokens, variables, and custom theme overrides are declared in the `@theme` directive within `src/app/globals.css` using OKLCH color spaces.
* **Typography**: Clean, modern sans-serif fonts are loaded to create a sleek dashboard layout suitable for long study sessions.

### 1.4 Supabase SSR Integration (`src/utils/supabase/`)
* **Modern Integration**: The app uses the newer `@supabase/ssr` client rather than the deprecated `@supabase/supabase-js` authentication library.
* **Server Action Compliance**: In `src/utils/supabase/server.ts`, the server client correctly awaits the `cookieStore` object passed from server actions/routes rather than synchronously invoking `cookies()` locally, avoiding hydration mismatches.

### 1.5 Reference Documentation Mismatches
We discovered three out-of-sync areas in the project's documentation files:
1. **Supabase Client Key**: `handoff.md` lists the environment variable as `NEXT_PUBLIC_SUPABASE_ANON_KEY`, whereas the actual client code in `client.ts` expects `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **Middleware Filename**: Documentation references the Next.js middleware in `src/middleware.ts`, whereas the repository implements the modern `src/proxy.ts` layout.
3. **Tailwind Config**: The documentation references a root-level `tailwind.config.js` file, which has been removed in favor of CSS variables in `src/app/globals.css` due to the Tailwind v4 upgrade.

---

## Section 2: Resolved & Remaining Codebase Issues

All 17 compilation issues (1 error, 16 warnings) identified by `npm run lint` and the known known runtime bugs are addressed as follows:

### 2.1 Resolved React 19 JSX-in-Try-Catch Error
* **File**: `src/app/flashcards/page.tsx:50`
* **Vulnerability**: Constructing JSX nodes inside a `try/catch` block. Because React evaluates JSX lazily, rendering errors thrown by math formulas (KaTeX) bypassed the catch block, triggering unhandled runtime exceptions.
* **Correction**: Rendered the KaTeX equations into a raw HTML string inside the `try/catch` block first. If successful, push the JSX node using `dangerouslySetInnerHTML` outside the block; otherwise, fall back to displaying the raw LaTeX source string.

```typescript
// Corrected KaTeX rendering flow
let html = '';
let success = false;
try {
  html = katex.renderToString(mathContent, { displayMode, throwOnError: false });
  success = true;
} catch {
  // ignore and allow fallback
}

if (success) {
  parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
} else {
  parts.push(match[0]);
}
```

### 2.2 Resolved React Hook & Memoization Warnings (16 Warnings)
* **Default Array Allocation**: Default fallbacks like `const chapters = subjectData?.chapters ?? [];` inside hooks created a new array reference on every render, triggering exhaustive-deps warnings. These have been wrapped in `useMemo` blocks:
  ```typescript
  const chapters = useMemo(() => subjectData?.chapters ?? [], [subjectData]);
  const topics = useMemo(() => chapters.find(c => c.id === chapterId)?.topics ?? [], [chapters, chapterId]);
  ```
* **Store Action Dispatcher**: In `src/app/tutor/page.tsx`, the store action dispatcher `handleLocalStoreAction` was re-created on each render. Wrapping it in a `useCallback` resolved downstream dependency invalidation on the `confirmAction` button callback.
* **Unused Variables**: Cleaned up variables declared but never used (e.g., `todayPlan` in `src/app/page.tsx:164` and `isItemHidden` in `src/app/settings/page.tsx:36`).
* **Missing Dependencies**: Added missing variables (e.g., `sessions` in the `useEffect` hook in `tutor/page.tsx`) to dependency arrays to prevent stale closures.

### 2.3 Uncontrolled Tab Desynchronization
* **File**: `src/app/log/page.tsx:597`
* **Issue**: The subject navigation tabs used the uncontrolled `defaultValue` attribute, but a secondary action attempted to control the selected subject programmatically via `setSelectedSubject()`. This caused the active tab visual focus to desync from the state.
* **Correction**: Changed the `<Tabs>` component to a controlled input by binding it to the `value` attribute and using the `onValueChange` callback:
  ```tsx
  <Tabs value={selectedSubject} onValueChange={(val) => handleSubjectChange(val as SubjectId)}>
  ```

### 2.4 Unhandled URL Parsing Crashes
* **Files**: `src/app/tutor/page.tsx:1374` & `src/app/api/chat/route.ts`
* **Vulnerability**: A malformed URL from the Tavily search results passed into `new URL(url).hostname` would throw a fatal JavaScript error and crash the UI or the API route.
* **Correction**: Encapsulated the URL constructor in a helper function wrapper `safeHostname` with a try/catch block returning a generic source fallback (e.g. `'external source'`).

---

## Section 3: Premium JEE Preparation Platform Blueprint

To build a premium, highly competitive preparation workspace that will become the go-to tool for JEE aspirants, we propose implementing five core advanced modules.

```mermaid
graph TD
    subgraph Client State [React Context Store]
        Store[useReducer Store] --> |Persists| Local[localStorage]
        Store --> |Syncs| DbClient[Supabase Client]
    end

    subgraph DB [Supabase Database]
        DbClient --> Users[users]
        DbClient --> MistakeVault[mistake_events]
        DbClient --> SRS[revision_tasks]
        DbClient --> Telemetry[topic_events]
    end

    subgraph AI Engine
        ChatRoute[/api/chat Route] --> Tavily[Tavily Search API]
        ChatRoute --> PromptTutor[AI Tutor Agent]
        ChatRoute --> PromptCoach[AI Coach Agent]
    end

    subgraph Core UX Modules
        MistakeVault --> |Feeds| ReplayArena[Mistake Replay Arena]
        SRS --> |Applies Forgetting Curve| AdaptivePlanner[Spaced Repetition Planner]
        Telemetry --> |Calculates Sigmoid Readiness| Analytics[Rank & Yield Dashboard]
        PromptTutor --> |Interprets Formulas| FormulaLookup[Interactive Step Sheets]
    end
```

### 3.1 Adaptive Spaced Repetition Planner (SM-2 Algorithm)
* **Concept**: Replaces the basic fixed 1-7-30 day revision scheduler with an adaptive spacing engine. Spacing intervals are determined by the student's mastery score (test accuracy) and subjective confidence level.
* **Mastery Metrics**:
  * High Mastery ($\ge 90\%$ accuracy, confidence $\ge 4$): Spacing expands to 7, 21, and 45 days.
  * Weak Mastery ($< 50\%$ accuracy, confidence $\le 2$): Spacing compresses to 1, 3, and 7 days.
* **State Updates**:
  * Dispatch `SCHEDULE_REVISION` adjusts the `due_date` field in `revision_tasks` dynamically based on the calculated intervals.
* **Supabase SQL Schema Extension**:
  ```sql
  -- Add ease factor and interval tracking to revision_tasks
  ALTER TABLE public.revision_tasks 
  ADD COLUMN ease_factor numeric(3,2) DEFAULT 2.50,
  ADD COLUMN interval_days integer DEFAULT 1,
  ADD COLUMN repetitions integer DEFAULT 0;
  ```

### 3.2 Mock Test Error Tracking & Replay Arena
* **Concept**: When a student completes a test, they tag their incorrect responses into cognitive categories: Calculation Mistakes, Formula Forgotten, Conceptual Gaps, Time Pressure, or Misreading. 
* **The Replay Arena**: A practice mode that queries the `mistake_events` table and generates daily short 5-question quizzes containing only their previously failed questions, promoting active recall until they are resolved.
* **State Reducer Actions**:
  * `ADD_MISTAKE`: Appends a mistake to the queue.
  * `RESOLVE_MISTAKE`: Removes the mistake when successfully solved in the Replay Arena.
* **Supabase SQL Schema**: Matches the existing `mistake_events` table:
  * `error_type` check constraint enforces: `concept_gap`, `formula_forgotten`, `calculation_mistake`, `time_pressure`, `misread_question`, `guessing_error`.

### 3.3 Dynamic Formula Lookup & Step-by-Step Interactive Sheets
* **Concept**: A unified formula search interface that renders LaTeX mathematics using KaTeX. Students can expand formulas to view step-by-step mathematical derivations in accordion views.
* **Interactive Element**: Formulas are linkable. Tapping "Practice" launches a mini-test containing questions related to the application of that specific formula.
* **UI Design**: Modern glassmorphism card lists featuring search query auto-highlighting, categorized by subject (Physics, Chemistry, Mathematics).

### 3.4 State-Persisted AI-Driven Test Prep
* **Concept**: The AI Coach can generate a custom diagnostic test matching the student's weak topic profiles.
* **State Persistence**: Tests can be paused and resumed. The timer state, current question number, and saved answers are synchronized to a `saved_test_sessions` table in Supabase.
* **Supabase SQL Schema Extension**:
  ```sql
  CREATE TABLE public.saved_test_sessions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
      test_title text NOT NULL,
      current_question_index integer DEFAULT 0,
      elapsed_seconds integer DEFAULT 0,
      questions_json jsonb NOT NULL,
      answers_json jsonb NOT NULL,
      updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );
  ```

### 3.5 Personalized Analytics Dashboard
* **Concept**: Advanced dashboards modeling student preparation metrics:
  * **Sigmoid Rank Projections**: Projects potential JEE Rank ranges by mapping readiness values ($0.0 - 100.0$) onto a bell curve of historical JEE cutoff grades.
  * **Marks Yield Efficiency**: Measures which chapters give the highest return on study hours (e.g. Modern Physics: high marks, low study hours vs Rotational Dynamics: low marks, high study hours).
  * **Burnout & Fatigue Index**: Tracks daily study durations and flags potential burnout risk if study hours exceed 12/day consecutively with dropping quiz accuracy.

---

## Section 4: Actionable Phased Roadmap

We propose a 4-phase implementation plan. Each phase builds upon the previous, ensuring code stability and compilation completeness.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ROADMAP EXECUTION PHASES                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Phase 1: Stabilization & Infrastructure                              │
│  ├─ Apply core compiler fixes                                          │
│  └─ Integrate ESLint & E2E lint checks into build runner                │
│                                                                        │
│  Phase 2: Error Vault & Replay Arena                                   │
│  ├─ Implement post-test auto-tagging & mistake classifications         │
│  └─ Build Replay Arena review dashboard and state reducers            │
│                                                                        │
│  Phase 3: Cognitive Spaced Repetition & Formula Lookup                 │
│  ├─ Integrate adaptive SM-2 algorithms into revision schedules         │
│  └─ Build interactive formula accordion sheets with math renderings    │
│                                                                        │
│  Phase 4: AI Telemetry & Predictive Analytics                          │
│  ├─ Sigmoid rank projections and Yield Marks calculations             │
│  └─ AI-driven customized test generation and state-persisted tests     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Stabilization & Infrastructure
* **Objective**: Establish build safety, ensure clean compiles, and align project documentation.
* **Files to Modify**:
  * `handoff.md` (Update environment variable keys and routing naming)
  * `eslint.config.mjs` (Add pre-commit lint rules)
* **Verification Plan**:
  * Run `npm run lint` and verify output is `0 errors, 0 warnings`.
  * Run `npm run build` to confirm output compiles cleanly.

### Phase 2: Error Vault & Replay Arena
* **Objective**: Launch the mistake classification UI and the Replay Arena quiz panel.
* **Files to Create/Modify**:
  * `src/app/tests/page.tsx` (Add post-test cognitive mistake classification modals)
  * `src/app/replay/page.tsx` **[NEW]** (Create Replay Arena review dashboard)
  * `src/store/index.tsx` (Implement `ADD_MISTAKE` and `RESOLVE_MISTAKE` reducers)
* **Database Updates**: Run `supabase_schema.sql` migrations to ensure `mistake_events` table is fully active.
* **Verification Plan**:
  * Complete a mock test, answer two questions incorrectly, tag them in the modal, and verify they populate the mistake queue.
  * Start a Replay Arena quiz, answer them correctly, and verify the mistakes are cleared from the state.

### Phase 3: Cognitive Spaced Repetition & Formula Lookup
* **Objective**: Integrate adaptive SM-2 algorithms and the math formula lookup UI.
* **Files to Create/Modify**:
  * `src/utils/supabase/sync.ts` (Implement SM-2 interval calculator)
  * `src/app/formulas/page.tsx` (Rewrite formula panel with search highlights and accordion derivations)
  * `src/app/revisions/page.tsx` (Sort revision tasks based on custom urgency calculations)
* **Verification Plan**:
  * Complete a topic with $100\%$ accuracy, check that its scheduled revision task is placed 7 days out.
  * Complete a topic with $30\%$ accuracy, check that its revision task is placed 1 day out.

### Phase 4: AI Telemetry & Predictive Analytics
* **Objective**: Launch rank projection analytics, yield efficiency charts, and pausable test preparation.
* **Files to Create/Modify**:
  * `src/app/analytics/page.tsx` (Implement Sigmoid projections chart, Yield analysis grid, and Fatigue alerts)
  * `src/app/tests/active/page.tsx` **[NEW]** (Create pausable active test view with saved session state)
  * `src/app/api/chat/route.ts` (Implement AI Tutor generation of customized weakness diagnostic mock tests)
* **Database Updates**: Create the `saved_test_sessions` table in Supabase.
* **Verification Plan**:
  * Log 14 consecutive days of study logs and check that the Yield Marks metric calculates Mechanics vs Optics efficiency accurately.
  * Launch a mock test, answer 3 questions, click "Pause", refresh the browser, and confirm the test resumes at question 4 with the timer restored.

---

## Verification & Testing Strategy

To guarantee the architectural integrity and prevent regressions during implementation:

1. **Static Type Checking**:
   * Execute `npx tsc --noEmit` on every phase completion to ensure TypeScript compilation safety.
2. **ESLint Checks**:
   * Execute `npm run lint` to enforce clean styling guidelines and catch unused variables or hook dependency violations.
3. **Playwright E2E Integration Tests**:
   * Create a new E2E file `e2e/mistake_tracking.spec.ts` to simulate completing a mock test, error-tagging, and resolving questions in the Replay Arena.
   * Create `e2e/spaced_repetition.spec.ts` to verify SM-2 interval calculations are correctly stored in local state and persisted to the database.
