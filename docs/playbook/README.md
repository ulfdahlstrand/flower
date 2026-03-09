# Developer Playbook

Implementation recipes accumulated by the Developer Agent over time.
Each file documents a recurring pattern — the reasoning, decisions, and
concrete steps for solving a specific type of task.

> **Maintained by:** Developer Agent
> **Read by:** Developer Agent at the start of any task that matches a pattern
> **Do not put here:** architectural decisions (those belong in `docs/arch/`) or
> acceptance criteria (those belong in the task issue)

---

## Index

| File | Pattern |
|------|---------|
| *(none yet — entries are added as patterns emerge)* | |

---

## When to add a new entry

Only create an entry when **both** conditions are true:
1. The pattern **repeats by design** — the project structure will require
   future developers to do the same type of task again.
2. The recipe captures something **non-obvious** not already clear from the
   architecture docs or the code itself.

One-off tasks, feature-specific logic, or patterns obvious from reading the
codebase should not get playbook entries.

## How to add a new entry

When the above conditions are met, create a new file in this directory:

**Filename:** `<short-slug>.md` (e.g. `backend-route-with-db.md`)

**Required sections:**
```markdown
# <Pattern title>

## When to use this
One sentence: what type of task triggers this pattern.

## Steps
Numbered, concrete steps. Reference actual file paths and conventions
from docs/arch/ where relevant.

## Gotchas
Things that went wrong or were non-obvious the first time.

## Example
Link to the task issue or PR where this pattern was first established.
```
