---
name: codebase-analysis
description: "Analyze a codebase by spawning domain-specific sub-agents, validate findings against real code, and synthesize into a compact instruction file (CLAUDE.md or AGENTS.md). Use when creating or updating project onboarding docs."
---

# Codebase Analysis Skill

Analyze a codebase thoroughly by parallelizing exploration across architectural domains, then synthesize findings into a structured instruction file for future agent sessions.

## When to Activate

- Creating or updating `CLAUDE.md`, `AGENTS.md`, or similar project instruction files
- Onboarding a new agent to an unfamiliar codebase
- Performing a comprehensive codebase audit after major changes

## Workflow

### Step 1 — Identify architectural domains

Scan the project structure to identify 3-6 distinct domains to explore in parallel. Typical domains:

| Domain | What to examine |
|--------|----------------|
| **Project structure & routing** | Directory tree, file organization, framework conventions |
| **API routes & integrations** | Backend endpoints, external API calls, streaming, middleware |
| **State management** | Store, reducers, context providers, persistence |
| **Auth & database** | Authentication flow, ORM/Supabase client, schema |
| **UI components & design system** | Component library, styling patterns, design tokens |
| **Build & tooling** | Package.json scripts, linting, testing, CI/CD |

Adjust domains to the actual project. Not every project has all of these.

### Step 2 — Spawn domain sub-agents

For each domain, spawn an exploration sub-agent with a focused prompt. Each sub-agent should:

1. Read the relevant files (use `Read` with offset/limit for large files)
2. Run targeted searches (`Grep`, `Glob`) to find patterns
3. Report findings in a structured format with specific file paths and line numbers

**Sub-agent prompt template:**

```
Deep dive into [DOMAIN] at [PATH].

Analyze and report on:
1. [Specific aspect 1] — list all [X], note patterns
2. [Specific aspect 2] — trace the flow, identify key functions
3. [Specific aspect 3] — check for edge cases, error handling
4. Notable patterns, anti-patterns, or gotchas

Include specific file paths and line numbers for all findings.
```

**Tips:**
- Keep sub-agent scopes narrow — one domain each
- Provide the project root path explicitly in each prompt
- For large files, tell sub-agents to use `Read` with offset/limit
- Spawn all domain sub-agents in parallel for speed

### Step 3 — Validate key findings

After sub-agents return, spot-check critical claims against the actual code:

- Verify file paths exist
- Check that line numbers are accurate
- Confirm framework/library names (e.g., `@base-ui/react` not Radix)
- Run `npm run lint` and `npm run build` to capture current status
- Check for deprecated APIs or stale documentation claims

This step prevents propagating incorrect information into the instruction file.

### Step 4 — Synthesize into instruction file

Write a compact instruction file following this structure:

```markdown
# [Project Name]

[One-line description]

## Commands

| Command | What |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| ... | ... |

## Architecture

- **Framework**: [name + version]
- **State**: [approach]
- **UI**: [library + notes]
- **Auth**: [approach]
- **Styling**: [approach]
- **API**: [approach]

## Key file locations

| Purpose | Path |
|---------|------|
| Root layout | `src/app/layout.tsx` |
| ... | ... |

## Known issues (do not re-introduce)

- [Issue 1 with file:line reference]
- [Issue 2]
```

**Principles for the instruction file:**
- Every line should answer: "Would an agent likely miss this without help?"
- Include only verified facts — no speculation
- Note framework-specific quirks and API differences from standard patterns
- Document known bugs that agents should preserve, not "fix"
- Include version numbers for key dependencies
- Mention if tests exist but lack npm scripts

### Step 5 — Final review

Before delivering the instruction file:

1. Re-read it end to end
2. Verify every file path mentioned exists (use `Glob`)
3. Verify every command works (use `Bash` for `npm run lint`, `npm run build`)
4. Check that no stale claims from a previous version carried over
5. Confirm the file is concise — remove anything an agent would figure out on its own

## Output

A single markdown file (`CLAUDE.md`, `AGENTS.md`, or equivalent) at the project root, containing verified, actionable information for future agent sessions.

## Anti-patterns to avoid

- **Don't dump raw file listings** — curate and annotate
- **Don't include obvious things** like "this is a TypeScript project" if the file tree makes it obvious
- **Don't copy stale claims** from old instruction files without re-verifying
- **Don't skip the validation step** — sub-agents can hallucinate file paths and line numbers
- **Don't make the file too long** — aim for 60-100 lines; link to external docs for deep dives
