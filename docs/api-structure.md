# Agent API Call Structure

This document defines how the orchestrator invokes each agent via the Claude API.
Each entry specifies: model, tools, and the context payload passed as the user message.

---

## Model Selection

| Agent | Model | Rationale |
|---|---|---|
| PM | `claude-sonnet-4-6` | Structured output, moderate reasoning, high volume of calls |
| Architect | `claude-opus-4-6` | Deep reasoning required for architectural decisions |
| Requirements Specialist | `claude-sonnet-4-6` | Structured work with clear inputs and outputs |
| Developer | `claude-sonnet-4-6` | Code generation, well-scoped tasks |
| Tester | `claude-sonnet-4-6` | Test writing and result analysis |
| Code Reviewer | `claude-opus-4-6` | Pattern reasoning across large diffs |

---

## Shared Tools (available to all agents)

```json
[
  {
    "name": "read_file",
    "description": "Read a file from the repository by path.",
    "input_schema": {
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "Repo-relative file path, e.g. docs/architecture.md" }
      },
      "required": ["path"]
    }
  },
  {
    "name": "write_file",
    "description": "Write or overwrite a file in the repository.",
    "input_schema": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "content": { "type": "string" }
      },
      "required": ["path", "content"]
    }
  },
  {
    "name": "github_get_issue",
    "description": "Get the full details of a GitHub issue including body and comments.",
    "input_schema": {
      "type": "object",
      "properties": {
        "issue_number": { "type": "integer" }
      },
      "required": ["issue_number"]
    }
  },
  {
    "name": "github_comment",
    "description": "Post a comment on a GitHub issue or PR.",
    "input_schema": {
      "type": "object",
      "properties": {
        "issue_number": { "type": "integer" },
        "body": { "type": "string" }
      },
      "required": ["issue_number", "body"]
    }
  },
  {
    "name": "github_add_label",
    "description": "Add a label to a GitHub issue or PR.",
    "input_schema": {
      "type": "object",
      "properties": {
        "issue_number": { "type": "integer" },
        "label": { "type": "string" }
      },
      "required": ["issue_number", "label"]
    }
  },
  {
    "name": "github_remove_label",
    "description": "Remove a label from a GitHub issue or PR.",
    "input_schema": {
      "type": "object",
      "properties": {
        "issue_number": { "type": "integer" },
        "label": { "type": "string" }
      },
      "required": ["issue_number", "label"]
    }
  }
]
```

---

## Agent-Specific Tools

### PM
```json
[
  {
    "name": "github_create_milestone",
    "description": "Create a GitHub milestone.",
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "due_on": { "type": "string", "description": "ISO 8601 date, optional" }
      },
      "required": ["title", "description"]
    }
  },
  {
    "name": "github_close_milestone",
    "description": "Close a completed GitHub milestone.",
    "input_schema": {
      "type": "object",
      "properties": {
        "milestone_number": { "type": "integer" }
      },
      "required": ["milestone_number"]
    }
  },
  {
    "name": "github_create_issue",
    "description": "Create a GitHub issue.",
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "body": { "type": "string" },
        "labels": { "type": "array", "items": { "type": "string" } },
        "milestone_number": { "type": "integer", "description": "Optional" }
      },
      "required": ["title", "body", "labels"]
    }
  },
  {
    "name": "github_list_issues",
    "description": "List GitHub issues filtered by labels or milestone.",
    "input_schema": {
      "type": "object",
      "properties": {
        "labels": { "type": "array", "items": { "type": "string" }, "description": "Optional label filters" },
        "milestone_number": { "type": "integer", "description": "Optional" },
        "state": { "type": "string", "enum": ["open", "closed", "all"], "description": "Defaults to open" }
      }
    }
  }
]
```

### Architect
```json
[
  {
    "name": "github_create_issue",
    "description": "Create a Feature or architectural task issue.",
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "body": { "type": "string" },
        "labels": { "type": "array", "items": { "type": "string" } },
        "milestone_number": { "type": "integer", "description": "Optional" }
      },
      "required": ["title", "body", "labels"]
    }
  },
  {
    "name": "github_get_pr_diff",
    "description": "Get the full diff for a pull request.",
    "input_schema": {
      "type": "object",
      "properties": {
        "pr_number": { "type": "integer" }
      },
      "required": ["pr_number"]
    }
  },
  {
    "name": "github_submit_pr_review",
    "description": "Submit a PR review (approve, request changes, or comment).",
    "input_schema": {
      "type": "object",
      "properties": {
        "pr_number": { "type": "integer" },
        "event": { "type": "string", "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT"] },
        "body": { "type": "string", "description": "Summary review comment" },
        "comments": {
          "type": "array",
          "description": "Optional inline comments",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "line": { "type": "integer" },
              "body": { "type": "string" }
            },
            "required": ["path", "line", "body"]
          }
        }
      },
      "required": ["pr_number", "event", "body"]
    }
  }
]
```

### Requirements Specialist
```json
[
  {
    "name": "github_create_issue",
    "description": "Create a Task issue.",
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "body": { "type": "string" },
        "labels": { "type": "array", "items": { "type": "string" } },
        "milestone_number": { "type": "integer", "description": "Optional" }
      },
      "required": ["title", "body", "labels"]
    }
  }
]
```

### Developer
```json
[
  {
    "name": "git_create_branch",
    "description": "Create and check out a new git branch.",
    "input_schema": {
      "type": "object",
      "properties": {
        "branch_name": { "type": "string", "description": "e.g. task/42-add-login-flow" }
      },
      "required": ["branch_name"]
    }
  },
  {
    "name": "git_commit_and_push",
    "description": "Stage specified files, commit with a message, and push the branch.",
    "input_schema": {
      "type": "object",
      "properties": {
        "files": { "type": "array", "items": { "type": "string" }, "description": "Repo-relative paths to stage" },
        "message": { "type": "string" }
      },
      "required": ["files", "message"]
    }
  },
  {
    "name": "github_create_pr",
    "description": "Open a pull request.",
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "body": { "type": "string" },
        "head": { "type": "string", "description": "Source branch name" },
        "base": { "type": "string", "description": "Target branch, usually main" },
        "labels": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["title", "body", "head", "base"]
    }
  },
  {
    "name": "list_files",
    "description": "List files in a directory (for exploring the repo structure).",
    "input_schema": {
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "Repo-relative directory path" }
      },
      "required": ["path"]
    }
  }
]
```

### Tester
```json
[
  {
    "name": "run_tests",
    "description": "Run the test suite or a specific test file and return output.",
    "input_schema": {
      "type": "object",
      "properties": {
        "command": { "type": "string", "description": "The test command to run, e.g. 'npm test' or 'pytest tests/test_auth.py'" }
      },
      "required": ["command"]
    }
  },
  {
    "name": "git_commit_and_push",
    "description": "Stage test files, commit, and push to the feature branch.",
    "input_schema": {
      "type": "object",
      "properties": {
        "files": { "type": "array", "items": { "type": "string" } },
        "message": { "type": "string" }
      },
      "required": ["files", "message"]
    }
  },
  {
    "name": "github_get_pr_diff",
    "description": "Get the full diff for a pull request.",
    "input_schema": {
      "type": "object",
      "properties": {
        "pr_number": { "type": "integer" }
      },
      "required": ["pr_number"]
    }
  }
]
```

### Code Reviewer
```json
[
  {
    "name": "github_get_pr_diff",
    "description": "Get the full diff for a pull request.",
    "input_schema": {
      "type": "object",
      "properties": {
        "pr_number": { "type": "integer" }
      },
      "required": ["pr_number"]
    }
  },
  {
    "name": "github_submit_pr_review",
    "description": "Submit a PR review with optional inline comments.",
    "input_schema": {
      "type": "object",
      "properties": {
        "pr_number": { "type": "integer" },
        "event": { "type": "string", "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT"] },
        "body": { "type": "string" },
        "comments": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "line": { "type": "integer" },
              "body": { "type": "string" }
            },
            "required": ["path", "line", "body"]
          }
        }
      },
      "required": ["pr_number", "event", "body"]
    }
  }
]
```

---

## Context Payloads (user message per invocation)

The orchestrator builds the user message dynamically before each API call.
Below is the template for each agent and invocation mode.

### PM — first run
```
You are being invoked to initialize a new project.

## Product Brief
<contents of /product/brief.md>

## Current State
No milestones or issues exist yet.
```

### PM — progress monitoring
```
You are being invoked to monitor project progress and resolve blockers.

## Open Issues
<github_list_issues result, all open issues with labels>

## Blocked Issues
<github_list_issues result filtered to status:blocked, with latest comment for each>

## Open Milestones
<list of open milestones with open/closed issue counts>
```

### Architect — Epic breakdown
```
You are being invoked to break Epic #<N> into Feature issues.

## Epic #<N>
<github_get_issue result: body + all comments>

## Current Architecture
<contents of /docs/architecture.md>

## Tech Decisions
<contents of /docs/tech-decisions.md>
```

### Architect — task review
```
You are being invoked to review Task #<N> for architectural fit.

## Task #<N>
<github_get_issue result: body + all comments>

## Parent Feature #<M>
<github_get_issue result: body only>

## Current Architecture
<contents of /docs/architecture.md>

## Task State
<contents of /tasks/{N}.json>
```

### Architect — PR review
```
You are being invoked to review PR #<PR> for architectural consistency.

## PR #<PR>
<github_get_pr_diff result>

## Referenced Task #<N>
<github_get_issue result: body + comments>

## Current Architecture
<contents of /docs/architecture.md>
```

### Requirements Specialist
```
You are being invoked to define Task issues for Feature #<N>.

## Feature #<N>
<github_get_issue result: body + all comments, including Architect notes>

## Parent Epic #<M>
<github_get_issue result: body only>

## Current Architecture
<contents of /docs/architecture.md>
```

### Requirements Specialist — re-invocation after blocker
```
You are being invoked to continue work on Task #<N> after a blocker was resolved.

## Task #<N>
<github_get_issue result: body + all comments>

## Task State
<contents of /tasks/{N}.json>

## Current Architecture
<contents of /docs/architecture.md>

Resume from where work was interrupted. Review conversation_log to identify the last completed step.
```

### Developer
```
You are being invoked to implement Task #<N>.

## Task #<N>
<github_get_issue result: body + all comments>

## Task State
<contents of /tasks/{N}.json>

## Current Architecture
<contents of /docs/architecture.md>

## Repository Structure
<list_files result for top-level and relevant subdirectories>
```

### Tester — pre-development review
```
You are being invoked to review Task #<N> for testability.

## Task #<N>
<github_get_issue result: body only — comments not needed at this stage>

## Task State
<contents of /tasks/{N}.json>
```

### Tester — post-development testing
```
You are being invoked to test the implementation of Task #<N>.

## Task #<N> — Acceptance Criteria
<github_get_issue result: body only>

## PR #<PR> Diff
<github_get_pr_diff result>

## Task State
<contents of /tasks/{N}.json>

## Test Conventions
<relevant section of /docs/architecture.md covering test file locations and naming>
```

### Code Reviewer
```
You are being invoked to review PR #<PR>.

## PR #<PR>
Title: <pr title>
Description: <pr body>

## Diff
<github_get_pr_diff result>

## Referenced Task #<N>
<github_get_issue result: body + comments>

## Current Architecture
<contents of /docs/architecture.md>

## Task State
<contents of /tasks/{N}.json>
```

---

## API Call Shape (pseudo-code)

```typescript
const response = await anthropic.messages.create({
  model: AGENT_MODEL[agentName],
  max_tokens: 4096,
  system: readFile(`docs/agents/${agentName}.md`),
  tools: [...SHARED_TOOLS, ...AGENT_TOOLS[agentName]],
  messages: [
    { role: "user", content: buildContextPayload(agentName, invocationMode, params) }
  ]
})
```

Tool results are handled in the standard agentic loop:
the orchestrator processes `tool_use` blocks, executes the tool, and sends back
`tool_result` blocks until the agent returns a final `end_turn` with no tool calls.
