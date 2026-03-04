# Agent Development Flow — Project Context

> Paste this file as context when starting a new Claude session to continue development.
> Repository: https://github.com/ulfdahlstrand/flower

---

## What We Are Building

A reusable multi-agent development flow where AI agents collaborate to design and
develop software products. The flow is managed through GitHub Issues and a structured
repository layout. It is designed to be reusable across multiple projects.

---

## Agent Roles

### Strategic Tier
Runs once per project or major feature. Establishes stable foundations before execution begins.

| Agent | Responsibility |
|-------|---------------|
| **PM** | Reads product brief, creates Milestones and Epic issues, assigns features to Architect, monitors progress. Only agent that may change status labels. |
| **Architect** | Breaks Epics into Features, maintains `docs/architecture.md` and `docs/tech-decisions.md`, reviews tasks for architectural fit, reviews PRs. |

### Execution Tier
Runs per task. Parallelizable across multiple tasks.

| Agent | Responsibility |
|-------|---------------|
| **Requirements Specialist** | Converts Feature issues into fully defined Task issues. Gets sign-off from Architect (fits system) and Tester (is testable) before finalizing. |
| **Developer** | Implements the task on a feature branch. Can flag blockers or scope questions via comments. Opens PR referencing the task. |
| **Tester** | Reviews tasks for testability at definition time. Writes tests on the feature branch after development. Reports pass/fail. |
| **Code Reviewer** | Reviews PRs for architectural consistency, patterns, and interface integrity. Not responsible for business logic (that's the Tester). |

---

## Issue Hierarchy

```
Milestone
└── Epic (type:epic)
    └── Feature (type:feature)
        └── Task (type:task)
```

---

## GitHub Labels

### Agent labels
| Label | Color |
|-------|-------|
| `agent:pm` | purple `#7057ff` |
| `agent:requirements` | blue `#0075ca` |
| `agent:architect` | orange `#e4812b` |
| `agent:developer` | green `#0e8a16` |
| `agent:tester` | yellow `#cccc00` |
| `agent:reviewer` | red `#d93f0b` |

### Status labels
`status:backlog` → `status:in-requirements` → `status:in-development` → `status:in-review` → `status:in-testing` → `status:done`

Also: `status:blocked`

### Type labels
`type:epic`, `type:feature`, `type:task`, `type:bug`

---

## Repository Structure

```
/
├── .github/
│   └── ISSUE_TEMPLATE/
│       ├── epic.md
│       ├── feature.md
│       └── task.md
├── docs/
│   ├── architecture.md         ← Architect maintains. Read-only for all other agents.
│   ├── tech-decisions.md       ← Append-only ADR log.
│   └── agents/
│       ├── pm.md               ← PM agent system prompt
│       ├── requirements.md     ← Requirements Specialist system prompt
│       ├── architect.md        ← Architect system prompt
│       ├── developer.md        ← Developer system prompt
│       ├── tester.md           ← Tester system prompt
│       └── reviewer.md         ← Code Reviewer system prompt
├── tasks/                      ← Per-task JSON state files ({issue-id}.json)
└── product/
    └── brief.md                ← PM reads this to initialize a project
```

---

## State Management Strategy (Hybrid)

Each task has two sources of truth that complement each other:

### GitHub Issue comments
Human-readable. Each agent posts a summary comment when it completes its work.
Used for: audit trail, human oversight, status visibility.

### `/tasks/{issue-id}.json`
Machine-readable. Full structured state that agents load and write.
Used for: agent context, conversation log, decisions, files to touch.

```json
{
  "issue_id": 42,
  "status": "in_development",
  "conversation_log": [
    {
      "agent": "requirements_specialist",
      "timestamp": "2026-03-01T10:00:00Z",
      "action": "drafted_task",
      "summary": "Defined login flow requirements based on Epic #12"
    },
    {
      "agent": "architect",
      "timestamp": "2026-03-01T10:45:00Z",
      "action": "approved_with_notes",
      "summary": "Use existing AuthService, don't create new one"
    }
  ],
  "decisions": {
    "approach": "extend AuthService",
    "files_to_touch": ["src/auth/AuthService.ts"],
    "risks": ["session token expiry edge case needs handling"]
  }
}
```

---

## Conventions

### Comment prefixes
Every agent prefixes its GitHub comments so the thread is scannable:
- `[PM]`
- `[REQUIREMENTS]`
- `[ARCHITECT]`
- `[DEVELOPER]`
- `[TESTER]`
- `[REVIEWER]`

### Branch naming
```
task/{issue-id}-short-description
```
Example: `task/42-add-login-flow`

### Architecture rule
`docs/architecture.md` is **read-only** for all agents except Architect.
Changes to architecture require a dedicated architectural task, never as a side-effect
of a feature task.

### Status label rule
Only the PM Agent may change status labels on issues.

### Architect-first rule
Architecture defines constraints before requirements finalizes tasks.
Order: Architect scopes the feature → Requirements Specialist writes tasks within those constraints.

---

## Key Design Decisions

1. **Two-tier flow** prevents the Architect and Requirements Specialist from deadlocking
   each other with circular dependencies.

2. **Developer can push back** — the Developer agent is not purely passive. It can post
   blocker comments and scope questions, which route back to Requirements Specialist.

3. **Code Reviewer is separate from Tester** — Tester owns behavioral correctness,
   Reviewer owns architectural consistency. Conflating them caused blind spots.

4. **GitHub Issues + JSON hybrid** — Issues for humans, JSON for agents. Storing raw
   agent conversations in GitHub comments was rejected as too noisy and hard to parse.

5. **PM is a router + decision-maker** at the strategic tier only. It does not
   participate in task-level execution to avoid micromanagement loops.

---

## What Still Needs To Be Done

- [ ] Write detailed system prompts for each agent (drafts exist in `docs/agents/`)
- [ ] Define the exact Claude API call structure for each agent (model, tools, context loading)
- [ ] Build the orchestration layer that invokes agents in the correct order
- [ ] Decide on the runtime: Claude Code, custom Node/Python script, or GitHub Actions
- [ ] Fill in `product/brief.md` with the first real project
- [ ] Test the full flow end-to-end with a simple first Epic

---

## Suggested Next Session Starting Prompt

> "I'm continuing work on a multi-agent development flow for the GitHub repo
> ulfdahlstrand/flower. Here is the full context: [paste this file].
> Today I want to work on: [pick one item from the todo list above]."
