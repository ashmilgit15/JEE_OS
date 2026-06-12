# Deep Logic Audit & Architectural Verification: JEE OS

This document details the logic audit of the AI-Powered Joint Entrance Examination (JEE) Preparation Operating System (**JEE OS**). It validates current codebase features, identifies gaps against user specifications, and defines an actionable roadmap to fix issues like question encoding, missing PDF uploads, and Strategy Advisor bottlenecks.

---

## 1. Executive Logic Audit & Core Feature Verification

We audited the core logic components of JEE OS to verify if they function correctly, scale for production, and match the specified preparation engine rules.

### 1.1 JEE Readiness Score Logic
* **Requirement:** Readiness score should not be based only on syllabus completion. It must combine completion %, test accuracy, revision consistency, confidence score, and mock performance.
* **Code Location:** [src/store/index.tsx:1290-1338](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx#L1290-L1338)
* **Verdict: ACTIVE & CORRECT**
  * The store calculates a weighted score for each subject using:
    $$\text{Readiness} = (\text{Completion \%} \times 0.30) + (\text{Confidence Score} \times 0.20) + (\text{Test Accuracy} \times 0.25) + (\text{Revision Consistency} \times 0.15) + (\text{Mastery ratio} \times 0.10)$$
  * It pulls test accuracy and revision consistency dynamically from completed tests and spaced repetition schedules in the global state, satisfying the requirements perfectly.

### 1.2 Spaced Repetition Revision Engine (SM-2 & FSRS)
* **Requirement:** automated spaced repetition revision planner scheduling intervals of 1, 7, and 30 days upon topic completion, with adaptive spacing adjustments.
* **Code Location:** [src/store/index.tsx:529-633](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx#L529-L633) (`COMPLETE_REVISION`) & [index.tsx:843-904](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx#L843-L904) (`SCHEDULE_REVISIONS`)
* **Verdict: ACTIVE & CORRECT**
  * **First Completion:** Dispatching `SCHEDULE_REVISIONS` calculates a dynamic "retention strength" ($0.1$ to $5.0$) based on topic test accuracy, confidence, and total hours studied. This defines a base interval (starting around 1–5 days) which scales exponentially using a strength multiplier to generate 3 to 4 sequential revision dates.
  * **Active Recall:** When completing a revision task, `COMPLETE_REVISION` applies the **SM-2 algorithm**. It maps the student's test accuracy and subjective confidence into an SM-2 response quality ($q: 0-5$), and recalculates the item's `easeFactor` and `intervalDays` to push the next due date farther out.

### 1.3 Error Intelligence System
* **Requirement:** Categorize test mistakes (Concept Gap, Formula Forgotten, Calculation Mistake, Time Pressure, Misread Question, Guessing Error) and track patterns.
* **Code Location:** [src/store/index.tsx:906-915](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx#L906-L915) & [src/app/tests/page.tsx:867-872](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/tests/page.tsx#L867-L872)
* **Verdict: ACTIVE & CORRECT**
  * When a mock test completes, incorrect responses are logged in the state `mistakes` array via `ADD_MISTAKE`.
  * The frontend UI lets students tag mistakes with exactly the six specified cognitive classifications.
  * These events are fed into the **Replay Arena** ([src/store/index.tsx:2279](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx#L2279)) which compiles a checklist of pending mistake review questions.

### 1.4 Daily Study Logging & School Sync
* **Requirement:** Log daily progress, auto-update topic status, and auto-sync school teacher progress context without manual selection.
* **Code Location:** [src/app/api/chat/route.ts:940](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/api/chat/route.ts#L940) (`augmentedSystemPrompt`) & [src/utils/ai/tools.ts](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/utils/ai/tools.ts) (`update_topic_status`, `log_study`)
* **Verdict: ACTIVE & CORRECT**
  * The AI Copilot system prompt includes structured markers `[MARK:<Topic Name>:<Status>]` and `[LOG:<Topic Name>:<Minutes>]`.
  * If the user says *"Today our teacher completed Domain and Range"* or *"I studied sets for 60 minutes"*, the AI intercepts this, resolves it to the correct topic ID using fuzzy matching, updates the syllabus, and logs the study session.

### 1.5 Gamification & Daily Planner
* **Requirement:** streaking system, achievements, weekly goals, and dynamic daily planning schedules.
* **Code Location:** [src/store/index.tsx:804-841](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/store/index.tsx#L804-L841)
* **Verdict: ACTIVE & CORRECT**
  * Streaks (current/longest study & revision) are updated daily. Achievements are tracked via conditional checks. The `generateDailyPlan` function compile-schedules study/revision/practice block items based on outstanding revisions and weak chapters.

---

## 2. Gaps & Gaps Analysis (System Gaps)

While the core preparation rules are mathematically implemented, there are architectural divergences and UI omissions compared to the user's initial specifications sheet:

### 2.1 Question Encoding Issues (AI Question Generator)
> [!WARNING]
> **Issue:** In fallback mode, the question builder parses raw Tavily search snippets with a naive regex. This strips necessary LaTeX notation, keeps raw HTML codes/entities (`&nbsp;`, `&lt;`, `&#39;`, `\n`), and generates generic distractors ("Option 1", "None of the above"), resulting in unreadable formula strings.
>
> **Fix:** We must implement a robust post-processing utility to decode HTML entities, clean scraped text, and normalize math formatting to guarantee that KaTeX renders math properly.

### 2.2 Missing File Upload & Offline Vector RAG
> [!IMPORTANT]
> **Requirement:** Resource Knowledge Base (RAG) allowing direct uploads of NCERT PDFs, notes, DPPs, and formula sheets.
>
> **Current Gap:** There is no standard HTML `<input type="file" />` in the Material Library page to allow local file ingestion. PDF/book indexing is instead performed using textbook web searches (via Tavily) and adding external URL links to the state. The mock OCR in the copilot is also simulated.
>
> **Recommendation:** Add a file upload widget on the Resources page, parse text from uploaded PDFs client-side (using `pdfjs-dist`), and index chunks in a local state array or sync them to Supabase to enable true offline search.

### 2.3 Technology Stack Divergences
* **Authentication:** Clerks/NextAuth was requested. The codebase instead implements **Supabase SSR Auth** (`@supabase/ssr` cookies) in the route handlers and middleware.
* **Backend Architecture:** A separate FastAPI server + PostgreSQL database was requested. The project instead uses a unified Next.js App Router (monorepo layout) using NextJS Server Actions and API Routes to sync with a Supabase PostgreSQL instance.
* *Note: The unified App Router approach is highly performant and secure; migrating to Clerk or FastAPI is only recommended if there is a specific multi-service SaaS requirement.*

### 2.4 AI Strategy Advisor Panel Bottleneck
* **Code Location:** [src/app/syllabus/page.tsx:430-511](file:///home/ashmilp/Documents/JEE_OS/jee-os/src/app/syllabus/page.tsx#L430-L511)
* **Issue:** The Strategy Advisor recommends focus topics based on a static list of prerequisites or overdue revisions. If a student is completely new (all topics are `not_started`), it defaults to recommending the very first unstarted topic. It also doesn't check if the prerequisite topics themselves have been finished before suggesting a dependent topic.

---

## 3. Implementation Plan & Actionable Roadmap

To stabilize the platform, resolve the encoding issues, and align the RAG knowledge base, we propose a 3-step action plan.

### Phase 1: Question Encoding & Math Rendering Corrections
1. **Develop HTML & LaTeX Sanitizer:** Create a helper function in `/src/utils/math-cleaner.ts` to:
   * Decode common HTML entities (`&alpha;`, `&beta;`, `&deg;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
   * Clean trailing newlines, bullet indices, and duplicate whitespaces.
   * Auto-wrap mathematical symbols and equations (e.g. `x^2`, `\int`, `\theta`) in `$` delimiters if they aren't already formatted.
2. **Update Fallback Generator:** Apply this cleaner in `src/app/api/chat/route.ts` inside `buildQuestionsFromSearchResults` and the question mock generators.
3. **Upgrade Client `renderInlineMath`:** Enhance the rendering utility in the tests page to safely parse formulas and decode raw characters.

### Phase 2: Material Library PDF Upload & Chunking
1. **Create HTML Upload Widget:** Modify `src/app/resources/page.tsx` to add an upload card accepting `.pdf` and `.txt` files.
2. **Implement Client-Side Parsing:** Import a lightweight PDF parser or load text from PDFs using `FileReader` / `pdfjs-dist` to extract plain text.
3. **Chunking & Indexing:** Split extracted text into 500-character overlapping chunks. Store these chunks in local storage / sync them to the Supabase database.
4. **Context Retrieval:** Update the AI Copilot to check both web search results AND local PDF chunks when answering resource-specific questions.

### Phase 3: AI Strategy Advisor Optimization
1. **Resolve Prerequisite Hierarchies:** Update `recommendedTopic` in the syllabus page to walk backwards: if a dependent topic is started but its prerequisite is unstarted or weak, block the dependent topic and recommend the parent prerequisite instead.
2. **Add Weighting to Strategy:** Integrate Yield marks efficiency so that the AI Strategy Advisor prioritizes high-yield chapters (e.g. Modern Physics, Mole Concept) over low-yield ones when recommending topics.

---

## 4. Verification Plan

We will run E2E Playwright tests and perform manual audits to verify that these logic improvements work:

### 4.1 Automated Tests
* Run clean-compile check:
  ```bash
  npm run build
  ```
* Run E2E suites:
  ```bash
  npx playwright test e2e/ai_features.spec.ts
  ```

### 4.2 Manual Verification
* Upload an NCERT physics PDF, type a question in the Resource Assistant, and verify the AI retrieves text chunks from the PDF and lists appropriate citations.
* Request a custom mock test on a complex topic (e.g., "Limits and continuity") and verify that LaTeX equations render cleanly without raw tags or entities.
