# JEE OS — Gap Analysis & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify every gap between the specification and the current codebase, then produce a prioritized implementation plan to close those gaps.

**Architecture:** Single-page Next.js 16 App Router. Client-side state via React Context + `useReducer` (persisted to localStorage + Supabase). AI via Hack Club proxy streaming NDJSON. All routes under `src/app/`. No monorepo.

**Tech Stack:** Next.js 16.2.7, React 19.2.4, Tailwind v4, `@base-ui/react`, Supabase SSR, Recharts, KaTeX, Zod, Playwright (E2E).

---

## Part 1: Feature-by-Feature Audit

### 1. Dashboard

| Spec Requirement | Status | Evidence |
|---|---|---|
| Today's study target | ✅ Built | `page.tsx:95-735` — shows study hours, pending revisions, streak, completed topics |
| Pending revisions | ✅ Built | `getPendingRevisions()` helper, displayed on dashboard |
| Daily streak | ✅ Built | `streaks.currentStudy` in state, displayed via `StatCard` |
| Study hours today | ✅ Built | `getTodayStudyHours()` helper |
| Chapters completed | ✅ Built | Counts topics with status completed/revised/mastered |
| Tasks completed | ⚠️ Partial | `dailyPlans` exists but dashboard doesn't show task completion count |
| JEE Readiness Score (per subject) | ✅ Built | `getReadinessScore('physics')` etc., displayed in readiness ring |
| Overall readiness | ✅ Built | `getOverallReadiness()` |
| Readiness based on completion + accuracy + revision + confidence + mock | ✅ Built | `getReadinessScore()` is a weighted calculation (store:1000+) |
| AI Strategy HUD | ✅ Built | `getWhatToStudyNext()`, `getExpectedJEEPerformance()`, `getBurnoutTelemetry()` |
| Motivational messages | ✅ Built | `getMotivationalMessage()` with day-of-year rotation |

**Dashboard gaps:**
- Task completion count not shown (minor)

---

### 2. AI Coach

| Spec Requirement | Status | Evidence |
|---|---|---|
| Proactive analysis panel | ✅ Built | `coach/page.tsx` — full AI coach with chat + insight cards |
| "Not revised X for N days" | ✅ Built | `generateInsights()` produces `revision_reminder` and `forgetting_alert` types |
| "Consistently lose marks in X" | ✅ Built | `generateInsights()` produces `weakness_alert` with evidence |
| "Accuracy dropped from X to Y" | ✅ Built | `generateInsight()` produces `accuracy_drop` with evidence strings |
| "Today's priority should be X" | ✅ Built | `generateInsights()` produces `priority_suggestion` |
| Feels like a personal mentor | ✅ Built | AI chat integration with context-aware system prompt |
| Trust indicators (evidence, confidence, dataPoints) | ✅ Built | `CoachInsight` type has `evidence`, `confidence`, `dataPoints` fields |
| Insight calibration tracking | ✅ Built | `getInsightCalibration()` helper |
| Dismiss/verify insights | ✅ Built | `DISMISS_INSIGHT` action, UI buttons |

**Coach gaps:** None — fully implemented.

---

### 3. Student Memory System

| Spec Requirement | Status | Evidence |
|---|---|---|
| Student name | ✅ Built | `StudentProfile.name` |
| Class | ✅ Built | `StudentProfile.class` |
| Target exam year | ✅ Built | `StudentProfile.targetYear` |
| Coaching details | ✅ Built | `StudentProfile.coaching` |
| Timetable | ⚠️ Partial | `preferredStudyTime` exists but no full timetable |
| Study habits | ⚠️ Partial | `studyStyle` exists but no habit tracking |
| Weak topics | ✅ Built | `StudentProfile.weakTopics` + `getWeakTopics()` |
| Strong topics | ✅ Built | `StudentProfile.strongTopics` + `getStrongTopics()` |
| Previous scores | ✅ Built | `StudentProfile.previousScores` |
| Preferred study style | ✅ Built | `StudentProfile.studyStyle` |
| Remember across sessions | ✅ Built | Supabase sync + localStorage persistence + `remember` AI tool |
| AI preferences | ✅ Built | `StudentProfile.aiPreferences` |

**Memory gaps:**
- No full timetable (only preferred time-of-day)
- No structured habit tracking (only studyStyle enum)

---

### 4. JEE Syllabus Tracker

| Spec Requirement | Status | Evidence |
|---|---|---|
| Physics/Chemistry/Mathematics | ✅ Built | `syllabus.ts` — 3 subjects, 30 chapters, 135 topics |
| Hierarchical chapters/topics | ✅ Built | `Subject > Chapter > Topic` type hierarchy |
| Status tracking (not_started → mastered) | ✅ Built | `TopicStatus` with 5 levels |
| Confidence score (1–5) | ✅ Built | `Topic.confidence` field |
| Last revision date | ✅ Built | `Topic.lastRevision` field |
| Accuracy % | ✅ Built | `Topic.accuracy` field |
| Per-topic display | ✅ Built | `syllabus/page.tsx` — full interactive tracker |
| Bulk operations | ✅ Built | `BULK_UPDATE_TOPICS`, `RESET_SYLLABUS_PROGRESS` actions |
| Exclude/include topics | ✅ Built | `TOGGLE_TOPIC_EXCLUSION` action |

**Syllabus gaps:** None — fully implemented.

---

### 5. Daily Study Logging

| Spec Requirement | Status | Evidence |
|---|---|---|
| Log daily progress | ✅ Built | `log/page.tsx` — full study logger |
| Auto-identify chapter/topic from description | ✅ Built | AI autofill via `handleAIAutoFill` in log page |
| Update syllabus progress | ✅ Built | `logStudy()` helper auto-updates topic status |
| Update revision schedule | ✅ Built | `completeTopicWithRevisions()` auto-schedules |
| Store learning history | ✅ Built | `studyLogs` array synced to Supabase |
| Quality score | ✅ Built | `qualityScore` field with auto-calculation from sleep/distractions |
| Session types (study/revision/practice/test/school) | ✅ Built | `StudyLog.type` enum |

**Logging gaps:** None — fully implemented.

---

### 6. Smart School Sync

| Spec Requirement | Status | Evidence |
|---|---|---|
| "Teacher completed X" → AI understands | ✅ Built | AI tutor chat parses natural language, calls `update_topic_status` |
| Auto-locate topic | ✅ Built | `findTopicByName()` fuzzy matching in tools |
| Update progress | ✅ Built | `update_topic_status` tool |
| Schedule revision | ✅ Built | Auto-schedules via `SCHEDULE_REVISIONS` |
| Generate practice questions | ⚠️ Partial | `generate_mock_test` tool exists but not auto-triggered from school sync |

**School sync gaps:**
- No auto-generation of practice questions after school sync (requires manual ask)

---

### 7. Revision Engine

| Spec Requirement | Status | Evidence |
|---|---|---|
| Spaced repetition (Day 1, 7, 30) | ✅ Built | `SCHEDULE_REVISIONS` action with FSRS-inspired scheduling |
| Auto-generate reminders | ✅ Built | `getPendingRevisions()`, `getOverdueRevisions()` |
| Track revision debt | ✅ Built | `getOverdueRevisions()` + dashboard display |
| Show overdue topics | ✅ Built | Dashboard shows overdue count, revisions page shows full list |
| SM-2 algorithm for flashcards | ✅ Built | `REVIEW_FLASHCARD` uses SM-2 with easeFactor/interval/repetitions |
| Mistake replay scheduling | ✅ Built | `MistakeEvent.nextReplayDate` + `getMistakeReplayQuestions()` |

**Revision gaps:** None — fully implemented.

---

### 8. AI Question Generator

| Spec Requirement | Status | Evidence |
|---|---|---|
| Topic tests | ✅ Built | `generate_mock_test` tool with `topicNames` filter |
| Chapter tests | ✅ Built | `generate_mock_test` tool with `chapterNames` filter |
| Mixed tests | ✅ Built | Default `testType: 'mixed'` |
| Daily quizzes | ✅ Built | `testType: 'daily'` |
| Difficulty levels (easy/medium/jee_main/jee_advanced) | ✅ Built | `Difficulty` type with 4 levels |
| Question generation prioritization | ⚠️ Partial | AI uses web search (Tavily) + hardcoded bank, no PYQ database |
| Avoid simplistic questions | ✅ Built | AI prompt instructs JEE-level difficulty |

**Question generation gaps:**
- Only 60 hardcoded questions (spec says 570 — likely outdated count)
- No structured PYQ (Previous Year Question) database
- No question quality scoring/feedback loop

---

### 9. Adaptive Testing System

| Spec Requirement | Status | Evidence |
|---|---|---|
| Adaptive question distribution | ✅ Built | `aiAdaptive` flag in `generate_mock_test` tool |
| Weak topic overweighting | ✅ Built | `aiAdaptive: true` injects mistake replays + weights weak topics |
| Strong topic underweighting | ✅ Built | Adaptive logic in test generation |
| Active test state management | ✅ Built | `START_ACTIVE_TEST`, `UPDATE_ACTIVE_TEST`, `CLEAR_ACTIVE_TEST` |
| Timer | ✅ Built | `elapsedTime` in `ActiveTestState` |

**Adaptive testing gaps:** Core logic works. No historical question performance tracking to refine weights over time.

---

### 10. Error Intelligence System

| Spec Requirement | Status | Evidence |
|---|---|---|
| Post-test mistake classification | ✅ Built | `ErrorType` enum with all 6 required categories |
| Track patterns over time | ✅ Built | `mistakes` array, analytics page shows error breakdown |
| "Most mistakes in X are calculation-based" | ✅ Built | Analytics page groups errors by type per subject |
| Generate analytics | ✅ Built | `analytics/page.tsx` — error type charts, subject breakdown |
| Mistake replay | ✅ Built | `replay/page.tsx` — full replay arena with quiz mode |
| AI-logged mistakes | ✅ Built | `add_mistake` and `resolve_mistake` AI tools |

**Error intelligence gaps:** None — fully implemented.

---

### 11. Mock Test System

| Spec Requirement | Status | Evidence |
|---|---|---|
| Full JEE Main mocks | ✅ Built | `testType: 'mock_main'` |
| Full JEE Advanced mocks | ✅ Built | `testType: 'mock_advanced'` |
| Subject-wise mocks | ✅ Built | `generate_mock_test` with `subjects` filter |
| Chapter-wise mocks | ✅ Built | `generate_mock_test` with `chapterNames` filter |
| Score tracking | ✅ Built | `TestAttempt.score` / `maxScore` |
| Percentile estimate | ✅ Built | `getExpectedJEEPerformance()` |
| Accuracy tracking | ✅ Built | Per-attempt and per-subject accuracy |
| Time spent | ✅ Built | `TestAttempt.timeSpent` |
| Topic breakdown | ✅ Built | `TestAttempt.subjectBreakdown` |
| Historical attempts | ✅ Built | `testAttempts` array, synced to Supabase |
| Mocks page | ✅ Built | `mocks/page.tsx` — browse and launch mocks |

**Mock test gaps:** None — fully implemented.

---

### 12. Performance Analytics Dashboard

| Spec Requirement | Status | Evidence |
|---|---|---|
| Accuracy trends (per subject) | ✅ Built | `analytics/page.tsx` — area charts per subject |
| Study hours (daily/weekly/monthly) | ✅ Built | Bar charts with time range selector |
| Weakest topics | ✅ Built | `getWeakTopics()` + ranked display |
| Strongest topics | ✅ Built | `getStrongTopics()` + ranked display |
| Revision debt display | ✅ Built | Overdue revisions section |
| Recharts integration | ✅ Built | AreaChart, BarChart, PieChart, RadarChart used |
| Readiness radar | ✅ Built | RadarChart for subject readiness |
| JEE performance prediction | ✅ Built | `getExpectedJEEPerformance()` + `getRankTrajectories()` |
| Burnout telemetry | ✅ Built | `getBurnoutTelemetry()` |
| Study efficiency | ✅ Built | `getStudyTimeEfficiency()` |

**Analytics gaps:** None — fully implemented.

---

### 13. Resource Knowledge Base (RAG)

| Spec Requirement | Status | Evidence |
|---|---|---|
| Upload PDFs/notes/DPPs | ⚠️ Partial | `resources/page.tsx` — can add links (URLs) but no file upload |
| RAG-based Q&A | ❌ Not built | No vector database, no embeddings, no semantic search |
| AI answers using uploaded resources | ❌ Not built | `add_resource` tool stores metadata only |
| Source references in answers | ❌ Not built | No RAG pipeline |

**RAG gaps — MAJOR:**
- No file upload capability (only URL links)
- No vector database (Chroma/Pinecone)
- No PDF ingestion pipeline
- No semantic search
- No context-aware retrieval
- Resources are metadata-only (name, URL, type)

---

### 14. AI Tutor

| Spec Requirement | Status | Evidence |
|---|---|---|
| Separate from AI Coach | ✅ Built | `tutor/page.tsx` separate from `coach/page.tsx` |
| Explain concepts | ✅ Built | AI chat with JEE-focused system prompt |
| Solve doubts | ✅ Built | Natural language Q&A |
| Create examples | ✅ Built | AI generates examples on request |
| Generate practice questions | ✅ Built | `generate_mock_test` tool callable from tutor |
| Explain mistakes | ✅ Built | AI analyzes mistakes from context |
| Support Physics/Chemistry/Math | ✅ Built | System prompt includes full syllabus context |
| JEE Main + Advanced levels | ✅ Built | Difficulty parameter in test generation |
| Math rendering (LaTeX) | ✅ Built | KaTeX integration with `$$...$$` syntax |
| Graph rendering | ✅ Built | `FunctionGraph` SVG component |
| Conversation persistence | ✅ Built | `ai_conversations` table in Supabase |
| Web search for deep questions | ✅ Built | Tavily integration + `deep_research` tool |
| DOM-aware context | ✅ Built | `getDOMSummary()` sends page context to AI |

**Tutor gaps:** None — fully implemented and feature-rich.

---

### 15. Daily Planner

| Spec Requirement | Status | Evidence |
|---|---|---|
| Auto-generate daily plans | ✅ Built | `generateDailyPlan()` in store |
| Based on timetable | ⚠️ Partial | Uses `preferredStudyTime` but no structured timetable |
| Based on school progress | ✅ Built | School-type logs factored in |
| Based on revision backlog | ✅ Built | Overdue revisions included in plan |
| Based on weak topics | ✅ Built | Weak topics prioritized |
| Based on upcoming tests | ⚠️ Partial | Test-type tasks included but no upcoming test dates tracked |
| Dynamic daily adaptation | ✅ Built | Plan regenerates based on current state |
| Planner page | ✅ Built | `planner/page.tsx` — full planner UI |
| AI can add tasks | ✅ Built | `create_plan_task` AI tool |

**Planner gaps:**
- No structured timetable input (only preferred time-of-day)
- No upcoming test date tracking

---

### 16. Gamification

| Spec Requirement | Status | Evidence |
|---|---|---|
| Study streaks | ✅ Built | `streaks.currentStudy`, `longestStudy` |
| Revision streaks | ✅ Built | `streaks.currentRevision`, `longestRevision` |
| Milestone achievements | ✅ Built | 12 achievements defined, `EARN_ACHIEVEMENT` action |
| Weekly goals | ✅ Built | `weeklyGoals` with configurable targets |
| No distracting game mechanics | ✅ Built | Clean, minimal gamification |

**Gamification gaps:** None — fully implemented.

---

### 17. Notifications

| Spec Requirement | Status | Evidence |
|---|---|---|
| Pending revisions | ⚠️ Partial | Dashboard shows count, but no push/browser notifications |
| Missed goals | ❌ Not built | No notification system |
| Upcoming tests | ❌ Not built | No notification system |
| Weak topics needing attention | ⚠️ Partial | Shown in dashboard, but no proactive notifications |

**Notification gaps:**
- No browser push notifications
- No notification center/inbox
- All "notifications" are passive dashboard elements

---

### 18. Technology Stack Compliance

| Spec Requirement | Status | Actual |
|---|---|---|
| Next.js | ✅ | 16.2.7 |
| TypeScript | ✅ | Strict mode enabled |
| Tailwind CSS | ✅ | v4 with CSS-first config |
| Shadcn UI | ✅ | base-nova style, `@base-ui/react` |
| Python FastAPI | ❌ | Not used — API routes are Next.js Route Handlers |
| PostgreSQL | ✅ | Via Supabase |
| Clerk or NextAuth | ⚠️ | Supabase Auth (different from spec but functional) |
| OpenAI API | ⚠️ | Hack Club AI Proxy (Gemini model) |
| LangChain | ❌ | Not used — custom AI pipeline |
| Vector Database | ❌ | Not used — no RAG |
| RAG pipeline | ❌ | Not built |
| Recharts | ✅ | Used in analytics |

---

## Part 2: Gap Summary

### CRITICAL GAPS (Core spec features missing)

| # | Gap | Spec Section | Effort |
|---|---|---|---|
| C1 | **No RAG / Resource Knowledge Base** — No file upload, no vector DB, no semantic search, no PDF ingestion | §13 | HIGH |
| C2 | **No Notification System** — No browser push, no notification center | §17 | MEDIUM |
| C3 | **Question bank too small** — 60 questions vs spec's 570, no PYQ database | §8 | MEDIUM |

### HIGH PRIORITY GAPS (Significant spec features incomplete)

| # | Gap | Spec Section | Effort |
|---|---|---|---|
| H1 | **No structured timetable** — Only `preferredStudyTime`, no day-by-day schedule | §3, §15 | MEDIUM |
| H2 | **No file upload for resources** — Only URL links, no actual PDF/notes upload | §13 | MEDIUM |
| H3 | **No upcoming test date tracking** — Planner can't factor in exam schedules | §15 | LOW |
| H4 | **No question quality feedback loop** — `userFeedback` field exists but not used to filter/rank | §8 | LOW |
| H5 | **School sync doesn't auto-generate practice questions** | §6 | LOW |

### MEDIUM PRIORITY GAPS (Nice-to-have spec features)

| # | Gap | Spec Section | Effort |
|---|---|---|---|
| M1 | **No task completion count on dashboard** | §1 | TRIVIAL |
| M2 | **No structured habit tracking** — Only `studyStyle` enum | §3 | LOW |
| M3 | **Python FastAPI not used** — API is Next.js Route Handlers (works fine, spec deviation) | §18 | N/A |
| M4 | **Supabase Auth instead of Clerk/NextAuth** — Works fine, spec deviation | §18 | N/A |
| M5 | **Hack Club proxy instead of OpenAI directly** — Works fine, spec deviation | §18 | N/A |
| M6 | **No LangChain** — Custom pipeline works fine | §18 | N/A |

---

## Part 3: Implementation Plan

### Task 1: Expand Question Bank to 570+ Questions

**Covers:** C3, §8

**Goal:** Grow the hardcoded question bank from 60 to 570+ questions covering all 135 topics.

**Files:**
- Modify: `src/data/questions.ts`

**Approach:**
- Generate ~4 questions per topic (135 × 4 = 540+)
- Ensure coverage across all 4 difficulty levels
- Include `skill`, `source`, `solutionSteps`, `commonMistake` metadata on ~30% of questions
- Prioritize NCERT-based questions with `source: 'NCERT'`

**Steps:**
- [ ] Audit current 60 questions for topic coverage gaps (which of the 135 topics have 0 questions?)
- [ ] Generate questions for uncovered topics (easy + medium first)
- [ ] Generate jee_main and jee_advanced questions for high-yield topics
- [ ] Add quality metadata (solutionSteps, commonMistake) to 30% of questions
- [ ] Verify: `npm run build` passes
- [ ] Run: `npx playwright test e2e/routes.spec.ts` to verify test page loads

---

### Task 2: Structured Timetable System

**Covers:** H1, §3, §15

**Goal:** Add a structured weekly timetable that the planner and AI can reference.

**Files:**
- Modify: `src/types/index.ts` — add `Timetable` type
- Modify: `src/store/index.tsx` — add timetable state + actions
- Create: `src/app/timetable/page.tsx` — timetable editor UI
- Modify: `src/components/layout/Sidebar.tsx` — add timetable nav item
- Modify: `src/store/index.tsx` `generateDailyPlan()` — factor in timetable

**Type definition:**
```typescript
interface TimetableSlot {
  id: string;
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  subject: SubjectId | 'break' | 'school';
  label: string;     // e.g. "Physics - Mechanics"
}

interface Timetable {
  slots: TimetableSlot[];
}
```

**Steps:**
- [ ] Add `Timetable` and `TimetableSlot` types to `src/types/index.ts`
- [ ] Add `timetable` to `AppState` with default empty slots
- [ ] Add `UPDATE_TIMETABLE` action to reducer
- [ ] Create `src/app/timetable/page.tsx` with grid-based weekly editor
- [ ] Add timetable nav item to `Sidebar.tsx`
- [ ] Update `generateDailyPlan()` to respect timetable slots
- [ ] Update AI system prompt to include timetable context
- [ ] Sync timetable to Supabase (add `timetable` column to `users` table)
- [ ] Verify: `npm run build` passes
- [ ] Run: `npx playwright test e2e/routes.spec.ts`

---

### Task 3: Notification Center

**Covers:** C2, §17

**Goal:** Add an in-app notification center that surfaces pending revisions, missed goals, and weak topic alerts.

**Files:**
- Modify: `src/types/index.ts` — add `Notification` type
- Modify: `src/store/index.tsx` — add notifications state + actions
- Create: `src/components/layout/NotificationCenter.tsx` — bell icon + dropdown
- Modify: `src/app/layout.tsx` — add NotificationCenter to layout
- Modify: `src/store/index.tsx` `generateInsights()` — also generate notifications

**Type definition:**
```typescript
interface AppNotification {
  id: string;
  type: 'revision_due' | 'goal_missed' | 'weak_topic' | 'test_reminder' | 'achievement';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  priority: 'high' | 'medium' | 'low';
}
```

**Steps:**
- [ ] Add `AppNotification` type and `notifications` to `AppState`
- [ ] Add `ADD_NOTIFICATION`, `MARK_NOTIFICATION_READ`, `CLEAR_NOTIFICATIONS` actions
- [ ] Update `generateInsights()` to also create notifications for high-priority items
- [ ] Create `NotificationCenter.tsx` component with bell icon + unread count badge + dropdown
- [ ] Add to `layout.tsx` next to `FloatingAICopilot`
- [ ] Auto-generate notifications on state changes (overdue revisions, missed goals)
- [ ] Verify: `npm run build` passes
- [ ] Run: `npx playwright test e2e/interactions.spec.ts`

---

### Task 4: Resource File Upload

**Covers:** H2, §13 (partial — upload only, not RAG)

**Goal:** Allow users to upload PDF files as study resources (stored locally or via Supabase Storage).

**Files:**
- Modify: `src/app/resources/page.tsx` — add file upload UI
- Modify: `src/types/index.ts` — extend `StudyResource` with `fileData?` field
- Modify: `src/store/index.tsx` — handle file storage

**Approach:**
- Use `FileReader` to convert PDFs to base64 data URLs for local storage
- For Supabase Storage integration, add optional upload to a `resources` bucket
- Keep it simple: store file metadata + data URL in state

**Steps:**
- [ ] Add `<input type="file" accept=".pdf,.txt,.md">` to resources page
- [ ] Implement `handleFileUpload()` that reads file as data URL
- [ ] Extend `StudyResource` type with optional `fileData: string` (base64)
- [ ] Store uploaded files in `resources` array via `ADD_RESOURCE`
- [ ] Add file preview/download capability
- [ ] Verify: `npm run build` passes
- [ ] Manual test: upload a PDF, verify it appears in resource list

---

### Task 5: Upcoming Test Date Tracking

**Covers:** H3, §15

**Goal:** Allow users to set upcoming exam dates so the planner can factor them in.

**Files:**
- Modify: `src/types/index.ts` — add `ExamDate` type
- Modify: `src/store/index.tsx` — add exam dates state
- Modify: `src/app/planner/page.tsx` — show countdown + factor into plans
- Modify: `src/app/settings/page.tsx` — exam date configuration UI

**Type definition:**
```typescript
interface ExamDate {
  id: string;
  name: string;       // e.g. "JEE Main 2027 Session 1"
  date: string;       // YYYY-MM-DD
  type: 'jee_main' | 'jee_advanced' | 'mock' | 'other';
}
```

**Steps:**
- [ ] Add `ExamDate` type and `examDates` to `AppState`
- [ ] Add `ADD_EXAM_DATE`, `REMOVE_EXAM_DATE` actions
- [ ] Add exam date config section to `settings/page.tsx`
- [ ] Show countdown on planner page
- [ ] Update `generateDailyPlan()` to increase revision priority as exam approaches
- [ ] Verify: `npm run build` passes

---

### Task 6: Question Quality Feedback Loop

**Covers:** H4, §8

**Goal:** Use the existing `userFeedback` field on `TestQuestion` to track question quality and filter low-quality questions.

**Files:**
- Modify: `src/app/tests/page.tsx` — add post-test feedback UI
- Modify: `src/store/index.tsx` — add `UPDATE_QUESTION_FEEDBACK` action
- Modify: `src/data/questions.ts` — filter logic for low-rated questions

**Steps:**
- [ ] Add `UPDATE_QUESTION_FEEDBACK` action to reducer
- [ ] Add post-test feedback prompt (rate each question: clear/confusing/too_easy/too_hard)
- [ ] Add `timesServed` increment logic when questions are shown
- [ ] Add filtering: deprioritize questions with `userFeedback === 'confusing'` or `avgAccuracy > 95`
- [ ] Verify: `npm run build` passes

---

### Task 7: Dashboard Task Completion Counter

**Covers:** M1, §1

**Goal:** Show today's completed vs total plan tasks on the dashboard.

**Files:**
- Modify: `src/app/page.tsx` — add task completion stat

**Steps:**
- [ ] Calculate completed/total tasks from `state.dailyPlans` for today
- [ ] Add a `StatCard` showing "Tasks: X/Y completed"
- [ ] Verify: `npm run build` passes

---

### Task 8: School Sync Auto-Practice Questions

**Covers:** H5, §6

**Goal:** After the AI processes a "teacher completed X" message, auto-generate a small practice set.

**Files:**
- Modify: `src/app/api/chat/route.ts` — add post-sync hook
- Or: Modify AI system prompt to auto-suggest practice after school sync

**Approach:**
- Update the AI system prompt so that after `update_topic_status` is called with type='school', the AI proactively offers to generate a practice quiz
- No code change needed — just prompt engineering

**Steps:**
- [ ] Update the tutor/coach system prompt to include: "After logging school progress, proactively suggest a 5-question practice quiz on the completed topic"
- [ ] Verify: `npm run build` passes
- [ ] Manual test: tell AI "teacher completed X", verify it offers practice quiz

---

## Part 4: Spec Deviations (Acceptable)

These are spec requirements that were implemented differently but work correctly:

| Spec Requirement | Actual Implementation | Verdict |
|---|---|---|
| Python FastAPI backend | Next.js Route Handlers | ✅ Acceptable — simpler, same functionality |
| Clerk/NextAuth auth | Supabase Auth | ✅ Acceptable — works with Supabase SSR |
| OpenAI API | Hack Club AI Proxy (Gemini) | ✅ Acceptable — same interface |
| LangChain | Custom AI pipeline | ✅ Acceptable — lighter, same capabilities |
| Chroma/Pinecone vector DB | Not implemented (RAG gap) | ❌ Not acceptable — core feature missing |

---

## Part 5: Priority Order

| Priority | Task | Impact | Effort |
|---|---|---|---|
| P0 | Task 1: Expand Question Bank | High — core content | Medium |
| P0 | Task 2: Structured Timetable | High — core feature | Medium |
| P1 | Task 3: Notification Center | High — user engagement | Medium |
| P1 | Task 4: Resource File Upload | Medium — partial RAG | Low |
| P2 | Task 5: Exam Date Tracking | Medium — planner improvement | Low |
| P2 | Task 6: Question Feedback Loop | Low — quality improvement | Low |
| P3 | Task 7: Dashboard Task Counter | Low — UI polish | Trivial |
| P3 | Task 8: School Sync Practice | Low — UX improvement | Trivial |

**Note on RAG (C1):** The full RAG pipeline (vector DB, embeddings, semantic search) is a major engineering effort (2-4 weeks). Task 4 provides file upload as a partial solution. A full RAG implementation should be a separate project/phase.

---

## Verification Commands

After completing any task, run:
```bash
npm run build          # TypeScript check + production build
npm run lint           # ESLint (should be 0 errors)
npx playwright test    # E2E tests (requires dev server)
```
