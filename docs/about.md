# About Flower

## Purpose

Flower is a multi-agent AI orchestrator that automates the software development process from product brief to merged pull request. It treats software development as a pipeline of specialist roles — PM, architect, requirements analyst, developer, tester, reviewer — and implements each role as an AI agent that communicates through GitHub Issues.

The goal is not to replace developers. It is to make it possible for a single person (or a small team) to build at a scale previously only achievable with a large team, by automating the coordination and handoff work that consumes most of the time in software projects.

---

## Design Philosophy

### The pipeline is the product
Flower is not a code generator. It is a structured process. Each agent has a narrow, well-defined responsibility. The value comes from the interactions between agents — the reviews, the sign-offs, the handoffs — not from any single agent's output.

### GitHub is the interface
All work happens in GitHub Issues. Epics, features, tasks, blockers, approvals — everything is a comment or a label on an issue. This means humans can read, intervene, or take over at any point without special tooling. The orchestrator listens to GitHub webhooks and reacts; it does not own a database or a separate UI.

### Configurable automation
Every agent role can be toggled between automated (AI-driven) and manual (human-driven) via the `MANUAL_AGENTS` environment variable. A team might start fully automated and gradually take control of roles they want ownership over. Or they might use Flower only for requirements and architecture, and keep development manual. Any combination is valid.

### Self-driving but not self-governing
The pipeline runs automatically: when a task completes, the next starts. But humans remain in control. Any issue can be commented on, re-routed, or closed manually. Agents post their reasoning in comments so humans can follow along and intervene. Nothing is a black box.

### One task at a time per branch, always committed
Agents never work across multiple tasks in a single session. Every piece of work — even blocked or incomplete work — is committed to a branch before stopping. This prevents rework and ensures that picking up after an interruption is always possible.

---

## Agent Roles

### Strategic Tier

These agents run once per project or major feature to establish stable foundations.

**PM (Project Manager)**
Reads `product/brief.md` and creates GitHub Milestones and Epic issues. Monitors pipeline capacity and advances backlog issues when agents become available. The only agent that may change status labels. Triggered automatically when the queue drains so the pipeline stays moving without manual intervention.

**PO (Product Owner)**
Handles incoming feature requests (`type:feature-request` issues). Asks clarifying questions in plain language, summarizes what has been agreed in English, waits for confirmation, then creates the correct issue type (epic, feature, or task) and closes the request.

### Execution Tier

These agents run per-task and can run concurrently across multiple tasks.

**Requirements Specialist**
Breaks epics into features and features into fully-specified task issues. Every task must have binary acceptance criteria — observable, measurable outcomes that a test can verify. Gets sign-off from both Architect and Tester before a task is considered ready for development.

**Architect**
Reviews features and tasks for architectural fit. Maintains `docs/architecture.md` and `docs/tech-decisions.md` (an append-only ADR log). The only agent that may write to architecture documentation. If a feature requires an architectural decision that hasn't been made yet, the Architect creates a dedicated architectural task first and blocks the feature until it is resolved.

**Developer**
Implements the task on a feature branch, following the architecture docs and acceptance criteria exactly. Can post blocker comments for unresolved dependencies, scope ambiguities, or missing architectural decisions. Always commits work-in-progress before stopping so sessions can be resumed. Opens a PR referencing the task when implementation is complete.

**Tester**
Reviews tasks before development to verify that every acceptance criterion is binary and testable. Does not write tests or run code — that is CI's job. If criteria are vague, subjective, or already enforced by CI (lint, build, type-check), the Tester sends them back to Requirements for revision.

**Reviewer**
Reviews pull requests for architectural consistency after CI passes. Checks folder structure, naming conventions, interface contracts, and prohibited patterns against `docs/architecture.md`. Does not review business logic — the Tester owns that. Triggered automatically by the orchestrator when all CI checks pass.

---

## The Pipeline

```
product/brief.md
    │
    ▼
[PM] Creates milestones + epics
    │
    ▼
[Requirements] Breaks epic into features
    │
    ▼
[Architect] Reviews each feature for architectural fit
    │  (may iterate with Requirements if gaps are found)
    ▼
[Requirements] Creates task issues for each feature
    │
    ▼
[Architect] Reviews each task for architectural fit
    │
    ▼
[Tester] Verifies acceptance criteria are testable
    │  (may iterate with Requirements if criteria are vague)
    ▼
[Developer] Implements on a feature branch, opens PR
    │
    ▼
[CI] Runs tests automatically on the PR
    │
    ▼
[Reviewer] Reviews PR for architectural consistency
    │
    ▼
PR merged → task closed → PM checks for newly unblocked tasks
```

---

## State Model

Each task has two sources of truth:

**GitHub Issue** — human-readable. Every agent posts a comment with its decision and rationale. Used for audit trail, human oversight, and visibility.

**`tasks/{issue-id}.json`** — machine-readable. Structured state that agents load and append to. Contains status, branch name, conversation log, and implementation decisions.

```json
{
  "issue_id": 42,
  "status": "in_review",
  "branch": "task/42-add-login-flow",
  "conversation_log": [
    {
      "agent": "requirements",
      "timestamp": "2026-03-01T10:00:00Z",
      "action": "drafted_task",
      "summary": "Defined login flow requirements"
    },
    {
      "agent": "architect",
      "timestamp": "2026-03-01T10:45:00Z",
      "action": "approved_with_notes",
      "summary": "Use existing AuthService, no new one"
    }
  ],
  "decisions": {
    "approach": "extend AuthService",
    "files_to_touch": ["src/auth/AuthService.ts"],
    "risks": ["session token expiry edge case"]
  }
}
```

---

## Issue Hierarchy

```
Milestone
└── Epic          (type:epic)        — a major product area
    └── Feature   (type:feature)     — a deliverable capability
        └── Task  (type:task)        — a single implementation unit
```

Feature requests (`type:feature-request`) sit outside this hierarchy. The PO agent processes them and creates the appropriate issue type when the request is sufficiently understood.

---

## Key Design Decisions

**Requirements leads, Architect consults.** Requirements proposes features; Architect reviews. This keeps the process demand-driven rather than architecture-driven, which matches how most software projects actually work.

**The pipeline is self-driving.** When the agent queue drains, PM is automatically notified to check for new work. When a task closes, PM checks if any blocked tasks are now unblocked. No human needs to "kick off" the next step.

**Agent labels signal state, not just routing.** A `agent:developer` label on an issue means either the developer is currently working on it, or it is waiting for a human developer (if `MANUAL_AGENTS=developer`). This makes the issue board a live view of where everything is in the pipeline.

**Branch per task, always.** The developer creates one branch per task and never works across tasks. The branch name is stored in the task JSON so future sessions resume on the same branch rather than creating duplicates.

**CI is the gate, not the Tester.** The Tester reviews testability before development. After development, CI runs the actual tests. The Reviewer is only triggered when CI passes. This keeps the Tester out of the post-development loop and avoids redundant agent runs.
