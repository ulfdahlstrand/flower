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
