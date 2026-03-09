# Flower

A self-driving, multi-agent software development orchestrator powered by Claude AI and GitHub Issues.

→ [About Flower — purpose, design, and philosophy](docs/about.md)

---

## What It Does

Flower runs a structured team of AI agents that collaborate to take a product idea from a brief all the way to a merged pull request — automatically. Each agent has a defined role, communicates through GitHub Issues, and hands off to the next agent when its work is done. The pipeline is self-driving: when a task completes the next one starts without human intervention.

The process is fully configurable. Any agent can be set to manual mode so a human handles that role instead. This lets Flower fit teams that want full automation, full human control, or anything in between.

---

## Agent Pipeline

```
Product Brief
    └── PM — creates milestones and epics
         └── Requirements — breaks epics into features and tasks
              └── Architect — reviews for architectural fit
                   └── Tester — verifies acceptance criteria are testable
                        └── Developer — implements and opens a PR
                             └── CI — runs tests automatically
                                  └── Reviewer — reviews the PR
```

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/ulfdahlstrand/flower
cd flower/orchestrator
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, REPO_PATH
```

### 2. Install and build

```bash
npm install
npm run build
```

### 3. Set up the target repository

```bash
# In the target project repo:
bash /path/to/flower/setup-repo.sh
```

### 4. Register the GitHub webhook

Point GitHub → Settings → Webhooks to `https://your-server/webhook` with your `GITHUB_WEBHOOK_SECRET`.
Subscribe to: `issues`, `issue_comment`, `pull_request`, `pull_request_review`, `check_suite`.

### 5. Write the product brief

Create `product/brief.md` in the target repo describing what you want to build.

### 6. Start the orchestrator

```bash
npm start
```

On startup, the orchestrator verifies labels and issue templates, then PM reads the brief and begins creating epics automatically.

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `GITHUB_TOKEN` | Yes | GitHub personal access token |
| `GITHUB_WEBHOOK_SECRET` | Yes | Shared secret for webhook verification |
| `GITHUB_OWNER` | Yes | GitHub org or username of the target repo |
| `GITHUB_REPO` | Yes | Target repository name |
| `REPO_PATH` | Yes | Absolute path to the local clone of the target repo |
| `PORT` | No | Webhook server port (default: `3000`) |
| `TEST_COMMAND` | No | Test command to run (default: `npm test`) |
| `MANUAL_AGENTS` | No | Comma-separated agents to handle manually, e.g. `developer,architect` |

---

## Repository Structure

```
flower/
├── docs/
│   ├── about.md              ← Project purpose and design philosophy
│   └── agents/               ← System prompts for each agent
│       ├── pm.md
│       ├── po.md
│       ├── requirements.md
│       ├── architect.md
│       ├── developer.md
│       ├── tester.md
│       └── reviewer.md
├── orchestrator/             ← Node.js webhook server and agent runner
│   ├── src/
│   │   ├── index.ts          ← Express server, webhook handler
│   │   ├── router.ts         ← GitHub event → agent routing
│   │   ├── queue.ts          ← Persistent FIFO queue with deduplication
│   │   ├── context.ts        ← Context builders for each agent
│   │   ├── loop.ts           ← Claude API agent loop
│   │   ├── agents.ts         ← Model and tool configuration per agent
│   │   ├── config.ts         ← Environment configuration
│   │   └── tools/            ← GitHub, file, git, and shell tool implementations
│   └── .env.example
├── setup-repo.sh             ← Minimal bootstrap for target repos
└── tasks/                    ← Per-task JSON state files (gitignored in target repos)
```

---

## Manual Trigger

Any agent can be invoked directly without a webhook event:

```bash
curl -X POST http://localhost:3000/trigger \
  -H 'Content-Type: application/json' \
  -d '{"agent": "developer", "issueNumber": 42}'
```

---

## Further Reading

- [About Flower — purpose, design, and philosophy](docs/about.md)
- [Agent system prompts](docs/agents/)
