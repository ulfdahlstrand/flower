#!/bin/bash
set -e
REPO="ulfdahlstrand/flower"

echo "🏷️  Creating labels..."

# Remove default labels that GitHub creates
gh label delete "bug" --repo $REPO --yes 2>/dev/null || true
gh label delete "documentation" --repo $REPO --yes 2>/dev/null || true
gh label delete "duplicate" --repo $REPO --yes 2>/dev/null || true
gh label delete "enhancement" --repo $REPO --yes 2>/dev/null || true
gh label delete "good first issue" --repo $REPO --yes 2>/dev/null || true
gh label delete "help wanted" --repo $REPO --yes 2>/dev/null || true
gh label delete "invalid" --repo $REPO --yes 2>/dev/null || true
gh label delete "question" --repo $REPO --yes 2>/dev/null || true
gh label delete "wontfix" --repo $REPO --yes 2>/dev/null || true

# Agent labels
gh label create "agent:pm"           --color "7057ff" --description "PM Agent"                      --repo $REPO
gh label create "agent:requirements" --color "0075ca" --description "Requirements Specialist Agent" --repo $REPO
gh label create "agent:architect"    --color "e4812b" --description "Architect Agent"               --repo $REPO
gh label create "agent:developer"    --color "0e8a16" --description "Developer Agent"               --repo $REPO
gh label create "agent:tester"       --color "cccc00" --description "Tester Agent"                  --repo $REPO
gh label create "agent:reviewer"     --color "d93f0b" --description "Code Reviewer Agent"           --repo $REPO

# Status labels
gh label create "status:backlog"          --color "eeeeee" --description "Not yet started"           --repo $REPO
gh label create "status:in-requirements" --color "c5def5" --description "Requirements being defined" --repo $REPO
gh label create "status:in-development"  --color "bfd4f2" --description "Being developed"            --repo $REPO
gh label create "status:in-review"       --color "fef2c0" --description "In code review"             --repo $REPO
gh label create "status:in-testing"      --color "f9d0c4" --description "Being tested"               --repo $REPO
gh label create "status:done"            --color "0e8a16" --description "Completed"                  --repo $REPO
gh label create "status:blocked"         --color "b60205" --description "Blocked"                    --repo $REPO

# Type labels
gh label create "type:epic"    --color "3e4b9e" --description "Large body of work"    --repo $REPO
gh label create "type:feature" --color "a2eeef" --description "Feature work"          --repo $REPO
gh label create "type:task"    --color "d4c5f9" --description "Single development task" --repo $REPO
gh label create "type:bug"     --color "d73a4a" --description "Bug fix"               --repo $REPO

echo "✅ Labels created"

# ── Folder structure + files ──────────────────────────────────────────────────

echo "📁 Creating repository structure..."

TMPDIR=$(mktemp -d)
cd $TMPDIR
git clone https://github.com/$REPO.git .

# .github/ISSUE_TEMPLATE/epic.md
mkdir -p .github/ISSUE_TEMPLATE
cat > .github/ISSUE_TEMPLATE/epic.md << 'TEMPLATE'
---
name: Epic
about: A large body of work spanning multiple features
title: '[EPIC] '
labels: 'type:epic, status:backlog, agent:pm'
---

## Goal
<!-- What outcome does this epic achieve? -->

## Background
<!-- Why are we doing this? What problem does it solve? -->

## Features
<!-- List of feature issues that make up this epic (fill in as they are created) -->
- [ ] #

## Success Criteria
<!-- How do we know this epic is complete? -->

## Out of Scope
<!-- Explicitly state what this epic does NOT cover -->
TEMPLATE

# .github/ISSUE_TEMPLATE/feature.md
cat > .github/ISSUE_TEMPLATE/feature.md << 'TEMPLATE'
---
name: Feature
about: A feature broken down from an Epic
title: '[FEATURE] '
labels: 'type:feature, status:backlog, agent:architect'
---

## Parent Epic
<!-- Link to parent epic -->
Closes #

## Description
<!-- What does this feature do? -->

## Tasks
<!-- List of task issues (fill in as they are created) -->
- [ ] #

## Architecture Notes
<!-- Relevant patterns, constraints, or decisions from the architect -->

## Out of Scope
TEMPLATE

# .github/ISSUE_TEMPLATE/task.md
cat > .github/ISSUE_TEMPLATE/task.md << 'TEMPLATE'
---
name: Task
about: A single development task
title: '[TASK] '
labels: 'type:task, status:backlog, agent:requirements'
---

## Parent Feature
<!-- Link to parent feature -->
Part of #

## Context
<!-- Why does this task exist? -->

## Task Description
<!-- What needs to be built, clearly and specifically -->

## Acceptance Criteria
- [ ] 
- [ ] 
- [ ] 

## Architecture Notes
<!-- Files to touch, patterns to follow, constraints -->

## Out of Scope
<!-- Explicit boundaries -->

## Agent Sign-offs
- [ ] Requirements Specialist approved
- [ ] Architect approved
- [ ] Developer assigned
- [ ] Tests written
- [ ] Review passed
TEMPLATE

# docs/
mkdir -p docs/agents

cat > docs/architecture.md << 'DOC'
# Architecture

> Maintained by the Architect Agent. All changes require a dedicated architectural task.

## Overview
<!-- High-level description of the system -->

## Sub-documents

Each domain has a focused sub-document. Agents should load only the sub-doc(s) relevant to their task.

| File | Contents |
|------|----------|
| [arch/frontend.md](arch/frontend.md) | UI framework, component structure, styling conventions |
| [arch/backend.md](arch/backend.md) | Server framework, API design, auth, service patterns |
| [arch/data-model.md](arch/data-model.md) | Database, schema, ORM, migration strategy |
| [arch/testing.md](arch/testing.md) | Test framework, file conventions, coverage expectations |
| [arch/infrastructure.md](arch/infrastructure.md) | Hosting, CI/CD, environment config, deployment |

## Cross-cutting Conventions

These apply everywhere regardless of domain.

**Commit format:** `type(scope): short description` — types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

**Branch naming:**
- Feature work: `task/{issue-id}-short-description`
- Architectural decisions: `arch/{issue-id}-short-description`

**Monorepo layout:**
<!-- Describe top-level folder responsibilities here -->

## Decision Log
See [tech-decisions.md](./tech-decisions.md)
DOC

mkdir -p docs/arch

cat > docs/arch/frontend.md << 'DOC'
# Frontend Architecture

> Maintained by the Architect Agent.

## Framework & Libraries
<!-- UI framework (e.g. React, Vue, Svelte), key libraries, and why they were chosen -->

## Component Structure
<!-- How components are organized — atomic design, feature folders, etc. -->

## Routing
<!-- Client-side routing approach and conventions -->

## Styling Conventions
<!-- CSS approach: Tailwind, CSS Modules, styled-components, etc. Design tokens/theme. -->

## State Management
<!-- How application state is managed — local state, context, stores, etc. -->

## Build & Bundling
<!-- Bundler (Vite, webpack, etc.), environment variables, asset handling -->
DOC

cat > docs/arch/backend.md << 'DOC'
# Backend Architecture

> Maintained by the Architect Agent.

## Framework & Runtime
<!-- Server framework (e.g. Express, Fastify, Hono), Node version, language -->

## API Design
<!-- REST, GraphQL, tRPC — URL conventions, versioning, response envelope format -->

## Authentication & Authorization
<!-- Auth strategy (JWT, session, OAuth), middleware, RBAC if applicable -->

## Service & Module Structure
<!-- How business logic is organized — services, repositories, handlers, etc. -->

## Error Handling
<!-- Standard error format, HTTP status code conventions, logging approach -->

## External Integrations
<!-- Third-party APIs, webhooks, background jobs -->
DOC

cat > docs/arch/data-model.md << 'DOC'
# Data Model

> Maintained by the Architect Agent.

## Database
<!-- Database system (PostgreSQL, MySQL, SQLite, MongoDB, etc.) and why -->

## ORM / Query Layer
<!-- ORM or query builder (Prisma, Drizzle, Knex, raw SQL, etc.) -->

## Schema Overview
<!-- High-level entity list and key relationships — link to migration files for detail -->

## Migration Strategy
<!-- How schema changes are managed: file naming, workflow, rollback policy -->

## Seeding & Test Data
<!-- How development and test databases are seeded -->
DOC

cat > docs/arch/testing.md << 'DOC'
# Testing Conventions

> Maintained by the Architect Agent. The Tester Agent reads this file for all testing decisions.

## Test Framework
<!-- Testing library (Jest, Vitest, pytest, etc.) and test runner -->

## File Conventions
<!-- Where test files live, naming pattern (e.g. *.test.ts next to source, or tests/ folder) -->

## Test Types
<!-- Unit, integration, e2e — what each covers and what tooling is used -->

## Running Tests
<!-- Commands to run tests locally and in CI -->

## Coverage Expectations
<!-- Minimum coverage thresholds, what is excluded -->

## Mocking & Fixtures
<!-- How external dependencies and data are mocked in tests -->
DOC

cat > docs/arch/infrastructure.md << 'DOC'
# Infrastructure

> Maintained by the Architect Agent.

## Hosting
<!-- Where the app runs: cloud provider, region, services used -->

## CI/CD
<!-- Pipeline tool (GitHub Actions, etc.), workflow overview, required checks before merge -->

## Environments
<!-- Environment list (dev, staging, production), how config differs between them -->

## Environment Variables
<!-- How secrets and config are managed — .env conventions, secret manager, etc. -->

## Deployment Process
<!-- How a merge to main becomes a production deployment -->

## Monitoring & Alerting
<!-- Logging, error tracking, uptime monitoring -->
DOC

cat > docs/tech-decisions.md << 'DOC'
# Technical Decisions (ADR Log)

> Append-only. Never delete or modify past decisions.

## Template
### [DATE] - [DECISION TITLE]
**Status:** Proposed | Accepted | Superseded  
**Context:** Why was this decision needed?  
**Decision:** What was decided?  
**Consequences:** What does this mean going forward?

---
DOC

cat > docs/agents/pm.md << 'DOC'
# PM Agent — System Prompt

## Role
You are the PM Agent. You orchestrate work across the multi-agent development flow.
You operate in the **strategic tier** and are the only agent that may change issue status labels.

## Responsibilities
- Read the product brief at `/product/brief.md`
- Create GitHub Milestones for major releases
- Create Epic issues for large bodies of work
- Assign features to the Architect for breakdown
- Monitor overall progress and unblock agents
- Re-enter the strategic tier when scope changes significantly

## You must NOT
- Write code
- Define technical implementation details
- Override architect decisions without creating a new architectural task

## Output Format
When creating issues, always use the correct issue template and apply appropriate labels.
When posting comments, prefix with `[PM]` and include a brief summary of your decision.
DOC

cat > docs/agents/requirements.md << 'DOC'
# Requirements Specialist Agent — System Prompt

## Role
You translate feature issues into clearly defined, testable task issues.
You operate in the **execution tier**.

## Responsibilities
- Read the Feature issue and architecture.md
- Draft a Task issue using the task template
- Consult the Architect (via comment) to verify the task fits the system
- Consult the Tester (via comment) to verify the task is testable
- Only mark `Requirements Specialist approved` once both sign off
- Update `/tasks/{issue-id}.json` with conversation log

## You must NOT
- Start a task until architect and tester have approved
- Change scope without re-consulting both agents
- Approve your own tasks

## Output Format
Prefix comments with `[REQUIREMENTS]`.
DOC

cat > docs/agents/architect.md << 'DOC'
# Architect Agent — System Prompt

## Role
You maintain the integrity of the system architecture across all tasks.
You operate in both tiers.

## Responsibilities
- Break Epic issues into Feature issues
- Maintain `/docs/architecture.md` and `/docs/tech-decisions.md`
- Review task drafts from Requirements Specialist for architectural fit
- Review PRs for consistency with architecture
- Flag when a task would require an architectural change

## You must NOT
- Write application code
- Approve tasks that contradict architecture without first updating architecture.md via a dedicated task

## Output Format
Prefix comments with `[ARCHITECT]`.
DOC

cat > docs/agents/developer.md << 'DOC'
# Developer Agent — System Prompt

## Role
You implement tasks according to the task description and acceptance criteria.
You operate in the **execution tier**.

## Responsibilities
- Read the Task issue and `/tasks/{issue-id}.json`
- Read relevant sections of `/docs/architecture.md`
- Implement the task on a feature branch named `task/{issue-id}-short-description`
- Open a PR referencing the task issue
- Comment if the task is underspecified or you encounter scope questions
- Never expand scope without PM approval

## You must NOT
- Merge your own PRs
- Skip writing to `/tasks/{issue-id}.json` after completing work

## Output Format
Prefix comments with `[DEVELOPER]`.
DOC

cat > docs/agents/tester.md << 'DOC'
# Tester Agent — System Prompt

## Role
You verify that tasks are testable at definition time, and that implementations
meet acceptance criteria at completion time.
You operate in the **execution tier**.

## Responsibilities
- Review task drafts for testability before work begins
- Write test files on the feature branch after development
- Comment pass/fail with what was tested and what was not
- Flag untestable acceptance criteria back to Requirements Specialist

## You must NOT
- Approve tasks with vague or unmeasurable acceptance criteria
- Mark tests as passing without actually running them

## Output Format
Prefix comments with `[TESTER]`.
DOC

cat > docs/agents/reviewer.md << 'DOC'
# Code Reviewer Agent — System Prompt

## Role
You ensure new code is consistent with the existing codebase, follows established
patterns, and does not break interfaces.
You operate in the **execution tier**, reviewing PRs before merge.

## Responsibilities
- Read the PR diff alongside `/docs/architecture.md`
- Check for pattern consistency, naming conventions, and interface integrity
- Approve or request changes with specific, actionable comments
- Do not review for business logic correctness — that is the Tester's role

## You must NOT
- Approve PRs that contradict architecture.md
- Block PRs for stylistic preferences not defined in architecture.md

## Output Format
Use standard GitHub PR review comments. Prefix summary comment with `[REVIEWER]`.
DOC

# tasks/ placeholder
mkdir -p tasks
cat > tasks/.gitkeep << 'DOC'
# This folder contains per-task JSON state files named {issue-id}.json
# They are created and updated by agents during task execution.
DOC

# product/brief.md
mkdir -p product
cat > product/brief.md << 'DOC'
# Product Brief

> The PM Agent reads this file to initialize a project. Fill this in before starting.

## Product Name


## Problem Statement
<!-- What problem are we solving and for whom? -->

## Goals
<!-- What does success look like? -->

## Non-Goals
<!-- What are we explicitly not doing? -->

## Target Users


## Key Features (high level)
1. 
2. 
3. 

## Constraints
<!-- Technical, time, budget, or other constraints -->

## Open Questions
<!-- Things that need to be resolved before or during development -->
DOC

# Commit and push
git add .
git commit -m "chore: initialize agent development flow structure"
git push origin main

echo "✅ Repository structure created and pushed"
echo ""
echo "🎉 Setup complete! Your repo is ready at https://github.com/$REPO"
echo ""
echo "Next steps:"
echo "  1. Fill in product/brief.md with your project details"
echo "  2. Run the PM agent to create your first Epic"
EOF
