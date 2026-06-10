# JEE OS: Technical Handoff & Architecture Documentation

Welcome to **JEE OS**, an AI-powered preparation system designed specifically for students preparing for the Joint Entrance Examination (JEE) in India. JEE OS combines syllabus progress tracking, spaced repetition schedule automation, grading-oriented testing, telemetry dashboards, and live agentic AI tutors to optimize study workflows.

This document serves as a complete technical guide for onboarding engineering teams.

---

## 1. Overview & Vision
JEE OS is designed as an all-in-one desktop companion for JEE candidates. The app focuses on:
*   **Quantitative Readiness Gauges**: Scoring mastery per topic and subject using a weighted average of subjective confidence and objective test performance.
*   **Spaced Repetition (Revision Engine)**: Automatically scheduling Day 1, Day 7, and Day 30 revisions upon topic completion to bypass the forgetting curve.
*   **Grading-Oriented Testing**: Simulating JEE Main/Advanced formats (+4 marks for correct answers, -1 for wrong answers, 0 for skipped) and letting users classify mistakes into cognitive error patterns.
*   **Agentic AI Coaching & Tutoring**: Actively recommending next steps (AI Coach) and resolving subject matter questions (AI Tutor) with web search capabilities and the power to dispatch state changes to the client-side store dynamically.

---

## 2. Project Architecture

JEE OS is built as a single-page web app with standard Next.js directory guidelines:

*   **Framework**: Next.js 16 (App Router) with React 19.
*   **Language**: TypeScript for complete type safety.
*   **Styling**: Tailwind CSS v4 utilizing modern glassmorphic theme tokens.
*   **State Management**: A custom, lightweight Zustand-like state manager built via React Context and `useReducer` to achieve synchronous state dispatching across the UI.
*   **Database & Services**: Supabase (`@supabase/ssr`) integrated for authentication and backend services, paired with external REST endpoints for web searching (Tavily) and AI completions.

### Project Directory Structure
```
/home/ashmilp/Documents/JEE_OS/jee-os/
├── src/
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── api/
│   │   │   └── chat/           # REST AI chat endpoint supporting streaming/NDJSON fallbacks
│   │   ├── analytics/          # Progress graphs (Recharts)
│   │   ├── coach/              # AI Coach panel & mentorship chat
│   │   ├── log/                # Study Logger with natural language parsing
│   │   ├── planner/            # Daily task checklist generator
│   │   ├── revisions/          # Spaced repetition status bins & calendar
│   │   ├── syllabus/           # Syllabus tracker grid
│   │   ├── tests/              # Adaptive test builder & question reviews
│   │   ├── tutor/              # Interactive AI Tutor with agentic tools
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main Dashboard
│   ├── components/             # Reusable UI components & layouts
│   │   ├── layout/             # Sidebar and Header
│   │   └── ui/                 # Core Tailwind primitive cards/buttons/inputs
│   ├── data/
│   │   ├── questions.ts        # Mock JEE Question Bank
│   │   └── syllabus.ts         # Official JEE Main syllabus structures
│   ├── lib/
│   │   └── utils.ts            # Classnames merger helper
│   ├── store/
│   │   └── index.tsx           # Global state context, reducer, and actions
│   ├── types/
│   │   └── index.ts            # System-wide type definitions
│   ├── utils/
│   │   └── supabase/           # Supabase client/server connection helpers
│   └── middleware.ts           # Route guard and session sync middleware
├── package.json                # Project dependencies and CLI scripts
└── tailwind.config.js          # Tailwind styling presets
```

---

## 3. Core Modules & Pages

### 3.1 Dashboard
*   **Path**: [src/app/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/page.tsx)
*   **Features**:
    *   *Daily Study Streak*: Tracks consecutive study log entries.
    *   *Readiness Gauges*: Visually reports overall preparation scores using custom weights.
    *   *Recent Logs & Overdue Revisions*: Surfaces immediate preparation gaps.
    *   *Quick Tasks*: Integrates checklist tasks from the Planner.

### 3.2 Syllabus Tracker
*   **Path**: [src/app/syllabus/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/syllabus/page.tsx)
*   **Features**:
    *   Renders a complete hierarchy of subjects (Physics, Chemistry, Mathematics), chapters, and individual topics.
    *   Allows updating topic-level tracking parameters:
        *   Confidence Rating (1 to 5 stars).
        *   Syllabus status: `not_started` | `in_progress` | `completed` | `revised`.
        *   Accuracy Score (0% to 100%) tracking test execution history.
    *   Transitioning a topic to `completed` triggers the creation of Spaced Repetition items automatically inside the state manager.

### 3.3 Study Logger
*   **Path**: [src/app/log/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/log/page.tsx)
*   **Features**:
    *   *Natural Language Auto-Fill*: Users can describe their session in free text (e.g., *"Studied electrostatics charge distribution for an hour"*). Clicking the **AI Auto-Fill** button queries `/api/chat` with a custom parser prompt to extract:
        *   Matched `subject`, `chapterId`, and `topicId` from the JSON syllabus tree.
        *   Estimated `duration` in minutes and study `type`.
    *   *Study History Timeline*: Groups study sessions chronologically with color-coded subject tags.
    *   *Today's Breakdown*: Aggregates total study hours, topics covered, and proportional subject distributions.

### 3.4 Revision Engine
*   **Path**: [src/app/revisions/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/revisions/page.tsx)
*   **Spaced Repetition Workflow**:
    *   Upon completing a topic, three revision items are scheduled:
        *   **Revision 1**: Due 1 day later (`+1 day`).
        *   **Revision 2**: Due 7 days later (`+7 days`).
        *   **Revision 3**: Due 30 days later (`+30 days`).
    *   Revisions are filtered into status bins: **Today**, **Upcoming**, **Overdue**, and **Completed**.
    *   *Revision Calendar*: Month-to-date visualization colored by status markers (red dots for overdue, green for completed, blue for pending).

### 3.5 Test Engine
*   **Path**: [src/app/tests/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tests/page.tsx)
*   **Features**:
    *   *Adaptive Weighting*: Prioritizes generating questions from topics identified as weak areas (low accuracy/confidence) in past logs or reviews.
    *   *Interactive Exam Client*: Timed environment featuring a sidebar question palette, marked states, and negative marking rules (+4 / -1 marks).
    *   *Error Classification*: Upon finishing a test, incorrect answers prompt the user to tag their mistake to an error class:
        *   `concept_gap` (Concept Gap)
        *   `formula_forgotten` (Formula Forgotten)
        *   `calculation_mistake` (Calculation Mistake)
        *   `time_pressure` (Time Pressure)
        *   `misread_question` (Misread Question)
        *   `guessing_error` (Guessing Error)
    *   Saved results feed directly into analytics and the AI Coach advice matrix.

### 3.6 AI Coach
*   **Path**: [src/app/coach/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/coach/page.tsx)
*   **Features**:
    *   *Insight Feed*: Generates smart alerts on preparation health (e.g., "Accuracy Drop Alert" in specific topics, "Overdue Revision Reminders").
    *   *Mentorship Chat*: Interactive chatbot preloaded with student performance stats (readiness scores, streaks, weak topics, and categorized test errors) to give highly contextualized strategic suggestions.

### 3.7 AI Tutor
*   **Path**: [src/app/tutor/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tutor/page.tsx)
*   **Features**:
    *   Acts as a real-time agent solving conceptual questions.
    *   Equipped with external tools, including real-time web search (Tavily API integration).
    *   Exhibits a collapsible streaming **Agent Steps Panel** detailing what tool is executing and what queries are being made.
    *   Can trigger client-side changes directly (such as adding a study log or flagging a topic to revision).

### 3.8 Advanced AI Control Hub
*   **Path**: [src/app/advanced/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/advanced/page.tsx)
*   **Features**:
    *   *AI Prep Hub*: Aggregates the Daily Decision Engine's highest-ROI study/practice tasks, the Burnout Detection fatigue index gauge, and the Forgetting Probability list estimating spaced retention gaps.
    *   *Error Replay*: Implements an interactive replay practice board where students review and re-solve past incorrect answers. Correct answers resolve the mistake status and update syllabus topic stats.
    *   *Dependency Graph*: Visualizes Mathematics/Calculus node dependencies and surfaces "fundamental warnings" when weak performance in a descendant node suggests gaps in a parent topic.
    *   *Rank Trajectory*: Plots four future percentiles projection paths (Current, With Revisions, Weaknesses Solved, and Broken Habit Path) using Recharts. Displays AI Mock Test Strategist diagnostic summaries.
    *   *Exam Simulator*: Simulates full exam stress sessions with countdown timer, negative markings, screen-shaking stress indicators under time pressure, and attempt strategy ratios (safe vs. avoid/skip counts).

---

## 4. State Management System

The state is defined and orchestrated in [src/store/index.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx).

### 4.1 Actions & Reducers
State modifications are dispatched via standard Action types:

```typescript
export type Action =
  | { type: 'UPDATE_PROFILE'; payload: Partial<AppState['profile']> }
  | { type: 'UPDATE_TOPIC_STATUS'; payload: { topicId: string; status: TopicStatus; accuracy?: number; confidence?: number } }
  | { type: 'ADD_STUDY_LOG'; payload: StudyLog }
  | { type: 'ADD_TEST_ATTEMPT'; payload: TestAttempt }
  | { type: 'COMPLETE_REVISION'; payload: { topicId: string; revisionNumber: number } }
  | { type: 'UPDATE_DAILY_PLAN'; payload: DailyPlan }
  | { type: 'COMPLETE_PLAN_TASK'; payload: { planId: string; taskId: string } }
  | { type: 'DISMISS_INSIGHT'; payload: string }
  | { type: 'RESET_STATE' };
```

### 4.2 State Schemas
*   **Topic Tracker Schema** (inside the `syllabus` tree):
    ```typescript
    interface Topic {
      id: string;
      name: string;
      status: 'not_started' | 'in_progress' | 'completed' | 'revised';
      confidence: number; // 1 to 5
      accuracy: number;   // 0 to 100
      lastStudied?: string;
    }
    ```
*   **Study Log Schema**:
    ```typescript
    interface StudyLog {
      id: string;
      date: string;       // ISO timestamp
      description: string;
      topicId: string;
      chapterId: string;
      subject: 'physics' | 'chemistry' | 'mathematics';
      duration: number;   // minutes
      type: 'study' | 'revision' | 'practice' | 'test' | 'school';
    }
    ```
*   **Revision Item Schema**:
    ```typescript
    interface RevisionItem {
      topicId: string;
      topicName: string;
      chapterName: string;
      subject: 'physics' | 'chemistry' | 'mathematics';
      revisionNumber: number; // 1, 2, or 3
      dueDate: string;        // YYYY-MM-DD
      completedDate: string | null;
    }
    ```

### 4.3 Core Algorithms & Calculations

#### 1. Readiness Score Calculation
The readiness gauge is a weighted balance of subjective confidence and objective test performance.
*   **Subject Weighting**:
    *   $\text{Subjective Component} = (\text{confidence} / 5) \times 100$
    *   $\text{Objective Component} = \text{accuracy}$
*   **Topic Readiness Score**:
    $$\text{Readiness} = (\text{Subjective Component} \times 0.4) + (\text{Objective Component} \times 0.6)$$
*   **Subject/Overall Readiness**:
    Computed as the average score across all topics belonging to that subject/overall syllabus. If a topic has a status of `not_started`, it is treated as $0\%$ readiness.

#### 2. Streak Counter Calculation
*   Re-computed on loading and after logging sessions.
*   Looks at unique dates in `studyLogs`.
*   Sorts logs in descending chronological order.
*   Counts consecutive days starting from today (or yesterday, if today hasn't been logged yet). The streak breaks if a gap greater than $1$ day exists between successive logs.

---

## 5. Agentic AI & Streaming Framework

The AI Tutor utilizes a real-time tool-calling framework modeled as an asynchronous execution loop.

### 5.1 NDJSON Stream Specification
The API endpoint at `/api/chat` communicates responses back to the client using a stream of Newline Delimited JSON (NDJSON) tokens:

```json
{"type": "status", "message": "Searching Tavily for: Coulomb's Law formulas..."}
{"type": "tool_input", "tool": "search", "query": "Coulomb's Law formulas"}
{"type": "tool_output", "tool": "search", "result": "..."}
{"type": "text", "content": "According to Coulomb's Law, the force..."}
{"type": "client_action", "action": "add_study_log", "params": {"topicId": "coulombs_law", "description": "AI Tutor session: Coulomb's Law review", "duration": 30}}
```

On the client side ([src/app/tutor/page.tsx](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tutor/page.tsx)), a custom reader decodes the chunks line-by-line:

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    const chunk = JSON.parse(line);
    // Process chunk.type: 'status' | 'text' | 'client_action' | 'citations'
  }
}
```

### 5.2 Client-Side Action Execution
When a `client_action` event type is parsed in the stream, the Tutor client page invokes the global store dispatcher automatically to keep states in sync without manual user effort:

*   **Action `add_study_log`**: Calls `logStudy()` with parameters supplied by the agent.
*   **Action `flag_revision`**: Dispatches `UPDATE_TOPIC_STATUS` setting status to `completed` (which auto-schedules spaced repetition tasks).

---

## 6. Services & Integrations

### 6.1 Supabase Configuration
*   Located in [src/utils/supabase/](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/supabase/)
*   Provides `createClient` helpers using cookies for servers, clients, and middleware configurations.
*   Enabled session guarding is implemented via [src/middleware.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/middleware.ts) to protect protected pages.

### 6.2 External APIs
*   **Tavily Search API**: Executed during Tutor agent steps. Performs web queries to pull updated reference materials and outputs results with exact source links formatted as a citations list.
*   **Hack Club AI Proxy**: Houses endpoints utilized to generate chat completions using high-performance models.

### 6.3 Relational SQL Schema Migration
For scaling to thousands of users, the application state has been mapped out into a relational schema described in [supabase_schema.sql](file:///home/ashmilp/Documents/JEE_OS/jee-os/supabase_schema.sql):
*   `users`: Tracks basic student profiles and daily study parameters.
*   `topics` & `user_topic_status`: Breaks down topic status, confidence, and accuracy metrics.
*   `study_logs`: Chronological logs of study duration and categories.
*   `revision_tasks`: Schedules spaced repetition events.
*   `test_attempts` & `mistake_events`: Manages detailed grades, subject breakdowns, and mistake path references.
*   `topic_events`: Telemetry records for status, confidence, and accuracy changes.
*   `readiness_snapshots`: Daily stats snapshots for progress charting.

---

## 7. Advanced Performance & Personalization Systems

### 7.1 Rank Prediction Engine
*   **Math Model**: Compiles an expected JEE Main score out of 300 using conceptual readiness (40% weight) and timed mock test performance (60% weight). Interpolates expected national percentile using a smooth statistical sigmoid curve, mapping scores directly to realistic percentile bands (e.g. 180 score -> 98.2 percentile).
*   **Target CSE Checking**: Compares expected score against a 240 target (NIT Trichy Computer Science Engineering cutoff) to calculate the remaining marks gap (e.g. *"Need +22 marks"*).

### 7.2 Time Analytics & Marks Yield
*   **Yield Yielding**: Computes yield efficiency as $\text{Marks per Hour} = \frac{\text{Subject Readiness}}{\text{Total Study Hours}}$. Shows yield efficiency metrics (marks gained per invested hour) to help identify study bottlenecks and inefficiencies.

### 7.3 "What Should I Study Next?" Recommender
*   **Priority Hierarchy**:
    *   *Priority 1 (Spaced Revision Alert)*: Immediate overdue or pending revisions based on forgetting curves.
    *   *Priority 2 (Concept Gap Correction)*: Weakest active topics (low accuracy or confidence) that need practice problems.
    *   *Priority 3 (Syllabus Progression)*: Unstarted core topics in the syllabus sequence to build foundation.

### 7.4 Forgetting Curve Spacing Intelligence
*   **Adaptive Revision Scheduling**: Replaces fixed Day 1/7/30 spacing with dynamic cycles based on quiz scores:
    *   *High Mastery ($\ge 90\%$ accuracy)*: Spacing intervals set to 7, 21, and 45 days (extended retention).
    *   *Weak Mastery ($< 50\%$ accuracy)*: Spacing intervals set to 1, 3, and 7 days (compressed review loops).
    *   *Standard*: Spacing intervals set to 1, 7, and 30 days.

### 7.5 Mistake Knowledge Graph
*   **Hierarchical Paths**: Traces question errors to exact nested nodes (e.g. `Physics -> Mechanics -> Kinematics -> Relative Velocity`) to discover deep bottleneck clusters (e.g. *"80% of your concept gaps originate from Mechanics"*).

---

## 8. Developer & Execution Commands

### 8.1 Setup Steps
1.  **Clone & Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Configuration**:
    Create a `.env.local` file in the root directory and specify the keys:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
    TAVILY_API_KEY=your_tavily_key
    ```

### 8.2 Run Commands
*   **Development Server**:
    ```bash
    npm run dev
    ```
*   **Code Linting**:
    ```bash
    npm run lint
    ```
*   **Production Build Check**:
    ```bash
    npm run build
    ```
*   **Production Server Start**:
    ```bash
    npm run start
    ```

