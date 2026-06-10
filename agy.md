# JEE OS — Codebase Architecture & Audit Manual

This document provides a technical blueprint of the JEE OS application and serves as a detailed diagnostic catalog of bugs, performance bottlenecks, and architectural issues identified during a comprehensive codebase audit.

---

## 1. Executive Summary

JEE OS is a specialized learning operating system built for IIT-JEE aspirants. It features adaptive syllabus tracking, automated spaced-repetition scheduling, test simulation with mistake analysis, fatigue tracking, and real-time AI mentoring. 

During the codebase audit, several architectural and logic issues were uncovered, ranging from critical sync data-loss patterns in Supabase to local state desyncs in uncontrolled components, database foreign key constraints violations, and session-refresh bypasses in the middleware. This document details the tech stack, maps the file routes, outlines the state and sync flows, and provides a catalog of these issues with step-by-step resolution designs.

---

## 2. Codebase Overview & Tech Stack

The application is structured as a single-page app utilizing the Next.js App Router.

*   **Framework & Core Library:** [Next.js 16.2.7](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L22) + [React 19.2.4](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L23)
*   **Design System & UI Components:** [@base-ui/react v1.5.0](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L12) (configured with `base-nova` style variant, utilizing the polymorphic `render` prop composition instead of Radix UI's `asChild`). Icons are supplied via `lucide-react`.
*   **Styling Engine:** [Tailwind CSS v4.0.0](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L42) with PostCSS, using a CSS-first configuration theme defined in [globals.css](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/globals.css#L7-L49). Color palettes are defined using HSL/OKLCH color variables for optimal dark-first rendering.
*   **Database & Auth Integration:** [Supabase SSR v0.10.3](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L13) via [supabase-js](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L14). Handles anonymous guest sessions and links them to PostgreSQL tables.
*   **Data Analysis & Utilities:** [date-fns v4.4.0](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L19) for date math and formatting; [recharts v3.8.1](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L26) for progress charts; [katex v0.17.0](file:///home/ashmilp/Documents/JEE_OS/jee-os/package.json#L20) for LaTeX formula formatting.

### Shell Execution Commands
*   **Development Server:** `npm run dev`
*   **Production Check & Build:** `npm run build`
*   **ESLint Audit:** `npm run lint`

---

## 3. Core Architecture Flow

```mermaid
graph TD
    User([User Browser]) --> UI[React 19 Components]
    UI --> Context[StoreContext StoreProvider]
    Context --> Reducer[useReducer State Engine]
    Reducer --> LocalStorage[(Local Storage)]
    Reducer --> SyncDebounce[Sync Debouncer 2s]
    SyncDebounce --> SupabaseClient[Supabase Client Client.ts]
    SupabaseClient --> SupabaseDB[(Supabase DB Postgres)]
    
    UI --> AICopilot[Floating AICopilot Component]
    UI --> AITutorPage[AI Tutor Page /tutor]
    
    AICopilot --> APIChat[/api/chat Route]
    AITutorPage --> APIChat
    
    APIChat --> Tavily[Tavily Search API]
    APIChat --> HackClubAI[Hack Club LLM Proxy]
    
    APIChat --> ClientAction[Client Action Executor]
    ClientAction --> Context
```

### A. Frontend Routing & Page Matrix
All routes are contained within the [app](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app) directory:

| Route Path | Component File | Description & Purpose |
| :--- | :--- | :--- |
| `/` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/page.tsx) | Main Dashboard, featuring the AI Strategy assessment, Burnout Forecast index, and readiness telemetry gauges. |
| `/syllabus` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/syllabus/page.tsx) | Interactive tracker representing chapters and topics. Recommends the next topics based on ROI and prerequisite links. |
| `/log` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/log/page.tsx) | Detailed history of studies, including duration, study types, distractions, and sleep telemetry. |
| `/revisions` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/revisions/page.tsx) | Spaced-repetition engine scheduling revisions on Day 1, 7, and 30 intervals based on the forgetting curve. |
| `/tests` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tests/page.tsx) | Quiz simulation arena where users select duration, subject, and tag cognitive error categories upon mistakes. |
| `/advanced` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/advanced/page.tsx) | Error Replay Arena and cognitive bottleneck visualizer (Forgetting Curves, Rank Trajectories, and ROI analytics). |
| `/coach` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/coach/page.tsx) | Conversational AI Coach offering deep study habit critiques, syllabus schedules, and mental health feedback. |
| `/tutor` | [page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tutor/page.tsx) | AI Tutor offering conceptual explanations, LaTeX mathematical formulas, and custom coordinate-based function plotting. |

### B. Global State & Context Selector Engines
Local state is managed via [index.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx). It declares a custom React Context and `useReducer` managing the `AppState` model defined in [index.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/types/index.ts#L215-L242).

#### Key Reducer Actions
*   `SET_STATE`: Replaces the state object on mount from cached storage.
*   `UPDATE_TOPIC_STATUS`: Recalculates topic status, completed date, and writes `TopicEvent` and `AuditEvent` records.
*   `ADD_STUDY_LOG`: Appends a study log and updates topic progress state.
*   `SCHEDULE_REVISIONS`: Calculates revision spacing ranges (Day 1, 7, 30 for baseline; Day 7, 21, 45 for $\ge 90\%$ accuracy; Day 1, 3, 7 for $< 50\%$ accuracy).
*   `ADD_MISTAKE` & `RESOLVE_MISTAKE`: Manages mistakes replay statuses.

#### Selector Analytics Engines
*   `getReadinessScore`: Calculates readiness percentage based on weighted factors (30% syllabus completion, 20% topic confidence, 25% mock test accuracy, 15% revision consistency, 10% mastered topic ratio).
*   `getExpectedJEEPerformance`: Predicts score intervals and percentile calculations using a custom statistical lookup curve.
*   `getTopicForgettingProbability`: Calculates memory decay curves based on intervals, sleep quality, and study time.
*   `getBurnoutTelemetry`: Integrates study averages, sleep inputs, and test trends to calculate a fatigue index.
*   `getPrerequisiteGaps`: Evaluates dependency constraints (e.g., *Application of Derivatives* requires *Methods of Differentiation*) and flags gaps.

### C. Database Schema Configuration
The PostgreSQL database layout is defined in [supabase_schema.sql](file:///home/ashmilp/Documents/JEE_OS/jee-os/supabase_schema.sql):

```
                       ┌──────────────────────────┐
                       │          users           │
                       └─────────────┬────────────┘
                                     │
         ┌───────────────┬───────────┼──────────────┬──────────────┐
         ▼               ▼           ▼              ▼              ▼
┌─────────────────┐ ┌──────────┐┌───────────┐ ┌────────────┐ ┌──────────┐
│user_topic_status│ │study_logs││rev_tasks  │ │test_attempt│ │mistakes  │
└────────┬────────┘ └────┬─────┘└─────┬─────┘ └─────┬──────┘ └────┬─────┐
         │               │            │             │             │
         └───────────────┼────────────┼─────────────┼─────────────┘
                         ▼            ▼             ▼
                    ┌──────────────────────────────────┐
                    │              topics              │
                    └──────────────────────────────────┘
```

*   `users`: Stores names, targets, classes, study times, and coaching affiliations.
*   `topics`: Static list representing subject topics.
*   `user_topic_status`: Maps users to topics, tracking status, confidence, accuracy, and timestamps.
*   `study_logs`: Tracks description, type, and durations of study sessions.
*   `revision_tasks`: Tracks spaced repetitions and completed times.
*   `test_attempts`: Stores mock scores, JSON question blocks, answers, and subject stats.
*   `mistake_events`: Logs incorrect answers tagged with cognitive error types.
*   `topic_events`: Tracks history logs of topic changes for graphs.
*   `readiness_snapshots`: Daily snapshot records for timeline charts.
*   `documents`: Stores documents and reference information.
*   `document_chunks`: Stores chunks and embeddings for research.
*   `ai_conversations`: Stores NDJSON format messages between user and AI agents.

### D. LLM Chat Stream & Search Proxy
The chat router at [route.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/api/chat/route.ts) implements real-time streaming using NDJSON chunks.

1.  **Search Evaluation:** Evaluates whether a query requires web search via `isGeneralWebSearchQuery` (checks for temporal variables, explicit keywords like *lookup*, or JEE cutoffs) or textbook lookup via `isTextbookQuery`.
2.  **Tavily Search Execution:** Fires search requests using Tavily API. Filters results to trusted sites (`TEXTBOOK_DOMAINS` like `ncert.nic.in` or `learncbse.in`) when searching for textbooks.
3.  **Prompt Augmentation:** Injects findings under a structured header in the system instructions.
4.  **Completion Model Call:** Streams text completions through the Hack Club AI Proxy using `gpt-4o-mini` (or falls back to a smart parser when keys are missing).
5.  **Action Dispatcher:** Decodes structured LLM output commands:
    *   `[MARK:Topic Name:status]` -> Triggers a frontend callback to run `UPDATE_TOPIC_STATUS`.
    *   `[LOG:Topic Name:minutes]` -> Triggers a frontend callback to run `ADD_STUDY_LOG`.

---

## 4. Bugs, Errors & Security Audit Catalog

### Bug 1: Broken Mistakes Persistence (Critical Logic/Sync Error)
*   **Vulnerability Location:** [tests/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tests/page.tsx)
*   **Technical Description:** When an exam attempt is completed, wrong answers are compiled in the local `TestAttempt.errors` array. However, the application never dispatches the `ADD_MISTAKE` action to save these individual mistakes to `state.mistakes`. Because of this, `state.mistakes` remains empty.
*   **Replay Board Impact:** The Mistake Replay Board falls back to showing two hardcoded mock mistakes. When the user resolves a mock mistake, it dispatches `RESOLVE_MISTAKE`. However, because the mock mistakes are not in the store's `state.mistakes` array, the resolver does nothing, and the mock mistakes can never be resolved.
*   **Database Sync Impact:** Because mistakes are never stored in the application state, they are completely omitted from the database sync loop, resulting in a total loss of mistake tracking data on reload.

#### Code Snippet (Vulnerable Pattern)
In `tests/page.tsx`, mistakes are only saved to the temporary local `errors` list:
```typescript
// src/app/tests/page.tsx
const errors = incorrectQuestions.map(idx => ({
  questionIndex: idx,
  errorType: errorTags[idx] || 'concept_gap',
  mistakePath: `${questions[idx].subject} -> ${questions[idx].chapterId} -> ${questions[idx].topicId}`
}));

const attempt: TestAttempt = {
  id: uuidv4(),
  date: new Date().toISOString(),
  questions,
  answers,
  errors, // Added to attempt object, but ADD_MISTAKE is never dispatched!
  ...
};
dispatch({ type: 'ADD_TEST_ATTEMPT', payload: attempt });
```

#### Remediation Design
Modify `tests/page.tsx` to dispatch `ADD_MISTAKE` for each incorrect question when completing a test. In addition, sync functions should be added to [sync.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts) to push mistake events to the `mistake_events` table and retrieve them on mount.

---

### Bug 2: Inefficient Sequential Upsert Loop (Performance Bottleneck)
*   **Vulnerability Location:** [sync.ts:91](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts#L91-L96)
*   **Technical Description:** In `syncTopicStatus`, the sync engine iterates over all topics in the syllabus (over 100 entries) and fires an individual Supabase `.upsert()` call for each one:
```typescript
for (const record of records) {
  await supabase.from('user_topic_status').upsert(record, {
    onConflict: 'user_id,topic_id',
    ignoreDuplicates: false,
  });
}
```
*   **Impact:** Because these network requests are fired sequentially, it creates a massive thread block and triggers API rate limits on every state save.

#### Remediation Design
Refactor the loop to perform a single, batch `.upsert()` operation:
```typescript
export async function syncTopicStatus(syllabus: Subject[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    const records = [];
    // ... compile records as before
    
    // Perform bulk upsert in a single network call
    const { error } = await supabase.from('user_topic_status').upsert(records, {
      onConflict: 'user_id,topic_id',
    });
    if (error) throw error;
  } catch (e) {
    console.error('Failed to sync topic status:', e);
  }
}
```

---

### Bug 3: Destructive Delete-then-Insert Sync Pattern (Data-Loss Risk)
*   **Vulnerability Location:** [sync.ts:121](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts#L121) (`syncStudyLogs`), [sync.ts:174](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts#L174) (`syncRevisions`), and [sync.ts:223](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts#L223) (`syncTestAttempts`)
*   **Technical Description:** To sync data, the engine deletes all existing rows for the user and then inserts the new ones:
```typescript
await supabase.from('study_logs').delete().eq('user_id', userId);
// ... chunk records
await supabase.from('study_logs').insert(records);
```
*   **Impact:** If the insertion fails due to a network drop, database timeout, or browser close, the user's historical data is permanently erased.

#### Remediation Design
Replace the delete-and-insert sequence with single-call upserts using primary keys:
1. Ensure study logs, revisions, and test attempts include unique IDs in their database schemas.
2. Update the sync functions to use `.upsert(records, { onConflict: 'id' })` instead of deleting existing records first.

---

### Bug 4: Metadata Corruption on Load (High Logic Error)
*   **Vulnerability Location:** [sync.ts:143](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts#L143-L167) (`loadStudyLogs`) and [sync.ts:192](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts#L192-L216) (`loadRevisions`)
*   **Technical Description:** When data is loaded from the database, metadata fields are hardcoded to fallback values:
```typescript
// In loadStudyLogs:
subject: 'physics' as const,
chapterId: '',

// In loadRevisions:
chapterId: '',
subject: 'physics' as const,
topicName: '',
chapterName: '',
```
*   **Impact:** This corrupts dashboard telemetry and revision charts, making chemistry and mathematics logs appear as physics, and wiping names from scheduled cards on reload.

#### Remediation Design
Update the database queries and schemas to preserve these values:
1. Ensure tables like `study_logs` and `revision_tasks` store the `subject_id`, `chapter_id`, and names.
2. Update the loader maps to populate these properties dynamically from the retrieved database records.

---

### Bug 5: Unseeded SQL Foreign Key Failure (High DB Error)
*   **Vulnerability Location:** [supabase_schema.sql:41](file:///home/ashmilp/Documents/JEE_OS/jee-os/supabase_schema.sql#L41)
*   **Technical Description:** The schema defines a foreign key constraint on the `user_topic_status` table:
```sql
topic_id text references public.topics(id) on delete cascade not null
```
However, the `topics` table is empty because the application does not have a seeding mechanism to populate it with static topics from [syllabus.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/data/syllabus.ts).
*   **Impact:** Any attempt to insert or update user topic statuses fails with a foreign key constraint violation, breaking progress tracking when connected to Supabase.

#### Remediation Design
Add a database seed step to `initSession` in [sync.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/sync.ts) to populate the `topics` table if it is empty:
```typescript
// Insert all topics from syllabus data into the database if they do not exist
const { data: existing } = await supabase.from('topics').select('id').limit(1);
if (!existing || existing.length === 0) {
  const allTopics = []; // Extract and format topics from defaultSyllabus
  await supabase.from('topics').insert(allTopics);
}
```

---

### Bug 6: Broken Auth Middleware Session Refresh (Medium Auth Error)
*   **Vulnerability Location:** [middleware.ts:15](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/middleware.ts#L15-L34)
*   **Technical Description:** The middleware helper creates a server client but does not execute any operations on it:
```typescript
createServerClient(
  supabaseUrl!,
  supabaseKey!,
  { cookies: { ... } }
);
```
Without calling `await supabase.auth.getUser()`, Supabase cannot intercept expired cookies or refresh the session.
*   **Impact:** User sessions expire prematurely even while the app is actively being used.

#### Remediation Design
Modify `createClient` in `middleware.ts` to be asynchronous and check the user session:
```typescript
export const createClient = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ ... });
  
  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  
  // CRITICAL: Triggers cookie refresh if expired
  await supabase.auth.getUser();
  
  return supabaseResponse;
};
```
Make sure to await this call in [proxy.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/proxy.ts#L5):
```typescript
export default async function proxy(request: NextRequest) {
  return await createClient(request);
}
```

---

### Bug 7: Division-by-Zero / Blank Screen in Test Engine (Medium UX Bug)
*   **Vulnerability Location:** [tests/page.tsx:240](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tests/page.tsx)
*   **Technical Description:** In `generateStrategyReport`, accuracy calculations do not guard against division-by-zero when `maxPossibleMarks` is `0`:
```typescript
const percent = Math.round((Math.max(totalMarks, 0) / maxPossibleMarks) * 100);
```
This occurs when a student filters tests to a subject or difficulty combination that has no questions, creating a quiz with an empty questions array.
*   **UX Impact:** The test engine transitions to the active quiz state (`taking`), but because the questions array is empty, `questions[currentQ]` is undefined. This causes the page to render `null`, resulting in a blank screen with no exit button.

#### Remediation Design
1. Prevent starting tests if the filtered question count is zero:
```typescript
if (filteredQuestions.length === 0) {
  // Show a warning and prevent transitioning state
  return;
}
```
2. Add a fallback value in `generateStrategyReport` to handle zero marks safely:
```typescript
const percent = maxPossibleMarks > 0 
  ? Math.round((Math.max(totalMarks, 0) / maxPossibleMarks) * 100) 
  : 0;
```

---

### Bug 8: Client-Side Routing Reload Bypass (Low UX Bug)
*   **Vulnerability Location:** [mocks/page.tsx:192](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/mocks/page.tsx)
*   **Technical Description:** When the user clicks the "Start Test" button on the Mock Test page, the application uses `window.location.href` to route to the Test Arena:
```typescript
window.location.href = '/tests';
```
*   **Impact:** This triggers a full browser reload, resetting ephemeral local state variables.

#### Remediation Design
Replace the window navigation call with Next.js's router hook:
```typescript
import { useRouter } from 'next/navigation';
// ...
const router = useRouter();
// ...
router.push('/tests');
```

---

## 5. Next-Generation Recommendations

> [!TIP]
> **Performance Optimization: Bulk Database Batching**
> Always batch database operations (like topic status syncing) into single-call queries. This reduces network overhead and prevents thread blocking during background saves.

> [!IMPORTANT]
> **Data Integrity: Use Transactional Logic**
> When writing sync engines, use upserts based on primary keys rather than destructive delete-then-insert patterns. This ensures that a network failure mid-operation does not lead to permanent data loss.

> [!WARNING]
> **Auth Session Handlers: Active Middleware Checks**
> Ensure the middleware actively validates sessions by calling `auth.getUser()`. Merely initializing the client is not enough to refresh cookies or maintain active sessions.

### Future Roadmap
1.  **Sync Diffing Table:** Implement a synchronization diffing engine that tracks local state modifications using timestamps. Only sync modified records to the database, rather than sending the entire state payload.
2.  **Controlled Components:** Convert the tab triggers in [syllabus/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/syllabus/page.tsx) to controlled states by passing the `value` prop. This ensures programmatically selected tabs are correctly highlighted in the UI.
3.  **Calibrated Calculations:** Separate accuracy and confidence ratings in `getSubjectStats` calculations to prevent distorted performance statistics.
