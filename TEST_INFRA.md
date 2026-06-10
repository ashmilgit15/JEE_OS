# E2E Test Infrastructure & Methodology — JEE OS

This document outlines the End-to-End (E2E) testing framework, feature inventory, 4-tier test case mapping, and execution methodology for the JEE OS refactoring project.

---

## 1. Feature Inventory (5 Key Features)

### F1: Dynamic Page Memory
- **Description**: Verification of the site-wide unified memory layer that tracks and updates active page context (route and state).
- **Core Operations**:
  - Feed route pathnames (e.g., `/`, `/syllabus`, `/tutor`) to the AI Copilot.
  - Dynamically update active route context when navigation occurs.
- **Verification Criteria**:
  - Correct context strings present in AI Copilot prompts.
  - Active path correctly displays inside the Copilot drawer.

### F2: Profile Adaptation
- **Description**: Verification of user profile state modifications.
- **Core Operations**:
  - Manual updates to the user profile via UI settings or forms.
  - AI-driven dynamic profile updates via `[UPDATE_PROFILE:key:value]` tool calls.
- **Verification Criteria**:
  - Saved profile settings persist to localStorage.
  - AI profile update actions update the app state.

### F3: Markup Tool Calls
- **Description**: Interception and execution of bracketed AI tool syntax.
- **Core Operations**:
  - Support for `[MARK:Topic:Status]`, `[LOG:Topic:Minutes]`, `[NAVIGATE:/path]`, `[CREATE_TASK:Time:Title:Desc]`, `[SCHEDULE_REVISION:Topic]`, `[UPDATE_PROFILE:Key:Value]`, and `[ADD_INSIGHT:Type:Message]`.
  - Confirmation cards in AI Tutor (requiring Confirm/Dismiss interaction).
  - Immediate execution in AI Coach and Floating Copilot (no confirmation cards).
- **Verification Criteria**:
  - Confirmation cards appear in AI Tutor with Confirm and Dismiss options.
  - Actions execute immediately in AI Coach / Copilot.
  - Execution state maps correctly to corresponding views (e.g., Syllabus, Planner, Dashboard insights, and Router navigation).

### F4: Agent Personalities & System Prompts
- **Description**: Verification of distinct agent roles, interfaces, prompts, and rendering.
- **Core Operations**:
  - Specific system prompt instructions per agent (Tutor = Subject Matter Expert, Coach = Strategist, Copilot = OS Navigator).
  - Stream status log tray rendering differences (Tutor and Copilot show tool logs, Coach skips them).
  - LaTeX / math syntax rendering (`$$` or `$` delimiters).
  - Floating Copilot quick action shortcuts (`/burnout`, `/study-plan`, `/formulas`).
- **Verification Criteria**:
  - Logs rendered correctly in Tutor and Copilot.
  - Quick action buttons successfully populate expanded prompt contents.
  - Math rendering containers resolve without crashing.

### F5: Post-Test Error Analysis & Replay Board
- **Description**: End-to-end flow from completing a test, tagging mistakes, to the replay arena.
- **Core Operations**:
  - Completing mock tests with correct/incorrect answers.
  - Manual classification of incorrect answers using error tags (e.g., `calculation_mistake`, `concept_gap`).
  - Strategy report generation via AI.
  - Saving test results and checking the Replay Board.
- **Verification Criteria**:
  - Correct calculation of test scores.
  - Error classification select dropdowns update state correctly.
  - Safe handling of mistake queue integration (checking fallback behavior and actual queue population).

---

## 2. 4-Tier Test Case Mapping

### Tier 1: Feature Coverage (Unit E2E)
- **TC-F1-1**: Verify active route context updates on the Copilot when switching between routes.
- **TC-F2-1**: Verify manual saving of name and target year in profile form.
- **TC-F3-1**: Verify `[MARK:...]` displays a confirmation card in AI Tutor, and clicking Dismiss leaves state unchanged.
- **TC-F3-2**: Verify `[MARK:...]` in AI Coach executes immediately without a card.
- **TC-F4-1**: Verify Floating Copilot drawer opens and displays active route context.
- **TC-F5-1**: Verify test completion, option selection, score calculations, and manual classification dropdowns.

### Tier 2: Boundary & Corner Cases
- **TC-F2-2**: Verify invalid or empty profile inputs are handled gracefully.
- **TC-F3-3**: Verify malformed tool call brackets (e.g., missing closing bracket or extra colons) do not crash the parser.
- **TC-F4-2**: Verify LaTeX rendering with multiple adjacent math blocks does not break UI layouts.
- **TC-F5-2**: Verify test scoring under edge cases, such as leaving all questions unanswered.

### Tier 3: Cross-Feature Combinations
- **TC-C1**: AI Tutor initiates `[UPDATE_PROFILE:key:value]`, which updates the profile state, and the updated profile name is immediately visible in the active context of the Floating Copilot.
- **TC-C2**: Taking a test, tagging a mistake, generating an AI recovery report, and verifying the mistake queue displays the correct cognitive tags.

### Tier 4: Real-World Scenarios
- **TC-S1**: Complete Study Loop: Student starts on Syllabus, navigates to Tutor, asks for a study plan. Tutor updates syllabus topic status and profile constraints. Student takes a mock test on the newly updated topic, classifies errors, saves results, and resolves the mistakes on the Replay Board.

---

## 3. E2E Test Methodology

- **Test Runner**: Playwright (`@playwright/test`) running against the local Next.js development server.
- **Mocking Strategy**:
  - `/api/chat` is mocked using `page.route` to intercept requests. Responses are returned as custom NDJSON streams containing event packets (e.g. `client_action` and text chunks) to ensure deterministic outputs.
  - Supabase REST API endpoints (e.g., `/rest/v1/*`) are mocked to isolate E2E tests from remote DB dependency and avoid rate limits.
- **State Audits**: Tests query `localStorage` (`jee-os-state`) directly via browser context evaluations to assert that updates are persisted accurately.
