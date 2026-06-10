# Original User Request

## Initial Request — 2026-06-07T15:27:31+05:30

Refactor the JEE OS codebase to be fully AI-centric, incorporating a global memory system that spans page contents, student weaknesses, and syllabus progress, while equipping the AI Tutor, AI Coach, and Floating Copilot with an expanded, robust set of tools and customized system prompts.

Working directory: /home/ashmilp/Documents/JEE_OS/jee-os
Integrity mode: development

## Requirements

### R1. Dynamic Page Memory & AI Growth
Implement a unified memory layer using the existing Custom React Context (`StoreContext` in `src/store/index.tsx`) synced to the Supabase database. Add page-content summarization to feed active page details (e.g. current page pathname and state) into the AI Copilot's memory context. Implement a profile adaptation mechanism (`[UPDATE_PROFILE:key:value]`) allowing the AI to dynamically adapt the student's profile state.

### R2. Omnipotent Tool Calling & Unified Dispatcher
Extend the text-based markup parser in the API route (`/api/chat/route.ts`) and all chat interfaces to support:
- `[MARK:Topic:Status]` (updates syllabus progress)
- `[LOG:Topic:Minutes]` (logs study sessions)
- `[NAVIGATE:/path]` (redirects browser using Next.js router)
- `[CREATE_TASK:Time:Title:Desc]` (pushes a planner task)
- `[SCHEDULE_REVISION:Topic]` (adds spaced repetition items)
- `[UPDATE_PROFILE:Key:Value]` (dynamically updates profile properties)
- `[ADD_INSIGHT:Type:Message]` (posts insight alert cards to the dashboard)
Ensure client-action event confirmation cards appear identically across the AI Tutor, AI Coach, and Floating Copilot, and coordinate the state modifications through a unified dispatcher.

### R3. Advanced Specialized System Prompts
Establish distinct, highly detailed system prompts for each agent:
- **AI Tutor** (`src/app/tutor/page.tsx`): Subject matter expert. Focuses on academic explanations, LaTeX mathematical rendering, function graphing, and marking the syllabus.
- **AI Coach** (`src/app/coach/page.tsx`): Strategist. Focuses on error pattern analysis, burnout prevention, task generation, and revision scheduling.
- **Floating Copilot** (`src/components/layout/FloatingAICopilot.tsx`): OS Navigator. Focuses on page summaries, quick study logging, navigation, and state queries.

### R4. Automated Error Analysis & Test Integration
Implement a post-test completion analysis function in `tests/page.tsx` that evaluates mistake patterns (e.g. calculation mistakes, conceptual gaps), auto-tags them, dispatches `ADD_MISTAKE` to populate the mistake queue, and logs them to database tables.

### R5. Code Correctness & Build Stability
All changes must compile successfully without TypeScript errors or ESLint errors. The production build (`npm run build`) must pass successfully.

## Acceptance Criteria

### Compilation & Build
- [ ] Next.js production build (`npm run build`) succeeds with zero errors.
- [ ] ESLint checks (`npm run lint`) pass with no errors.

### AI Tool Calls Verification
- [ ] AI Tutor, Coach, and Copilot successfully execute tool calls using the `[MARK:...]`, `[LOG:...]`, `[NAVIGATE:...]`, `[CREATE_TASK:...]`, `[SCHEDULE_REVISION:...]`, `[UPDATE_PROFILE:...]`, and `[ADD_INSIGHT:...]` markers.
- [ ] The `[NAVIGATE:...]` tool successfully routes the client window between paths (e.g., `/tutor` to `/tests`) without triggering full browser reloads.
- [ ] The `[ADD_INSIGHT:...]` tool creates new insight cards displayed on the main dashboard.
- [ ] Complete test errors auto-tag mistake patterns and dispatch them to the Replay Arena.

## Follow-up — 2026-06-10T20:50:19+05:30

Analyze the JEE OS codebase structure, reference documentation, and logic to produce a comprehensive technical audit and an actionable roadmap for building a state-of-the-art, premium JEE preparation platform.

Working directory: /home/ashmilp/Documents/JEE_OS/jee-os
Integrity mode: development

## Requirements

### R1. Deep Codebase & Reference Audit
- Perform a thorough code-level audit of the single-page Next.js App Router structure (`src/app/`), the custom React Context state management (`src/store/index.tsx`), styling/theme configurations (Tailwind v4 CSS-first), and Supabase SSR integration.
- Analyze local reference documentation (`AGENTS.md`, `PROJECT.md`, `TEST_INFRA.md`, `handoff.md`) to verify if the codebase aligns with the documented architecture.
- Identify specific instances of known issues: lint errors, React 19/Next 16 deprecations, memory leaks, unhandled API runtime crashes, and state/UI desynchronization bugs.

### R2. Architectural & Feature Enhancements for JEE Aspirants
- Propose advanced feature sets and UX/AI designs tailored to the specific needs of JEE aspirants (e.g., mock test error tracking, spaced repetition planners, dynamic formula lookup, state-persisted AI-driven test prep, personalized analytics dashboards).
- Outline technical designs for these features, detailing how they integrate into the existing React context/reducer state and Supabase schema.

### R3. Actionable Multi-Phase Roadmap
- Deliver a structured, phased implementation roadmap to transition the JEE OS application from its teamwork to the advanced platform.
- Each phase must include specific files to modify, new tables to add (if any), state changes, and testing strategies.

## Acceptance Criteria

### Audit & Recommendations Deliverables
- [ ] A comprehensive `jee_os_audit_and_roadmap.md` document written to the project root directory.
- [ ] The report must contain a section-by-section breakdown of:
  1. Codebase structural audit (Next.js, React, Tailwind v4, State, Database sync).
  2. Concrete bugs & warnings list with line references and correction paths.
  3. Advanced features blueprint tailored for JEE preparation.
  4. Phased execution roadmap.
- [ ] The recommendations must be technically viable and respect the project's tech stack constraints (Next.js 16.2.7, React 19.2.4, Tailwind v4, `@base-ui/react`, Supabase SSR).
- [ ] Every recommended feature must include a proposed verification/testing plan.
