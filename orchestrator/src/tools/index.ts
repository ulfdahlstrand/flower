import type Anthropic from '@anthropic-ai/sdk'
import * as github from './github.js'
import * as files from './files.js'
import * as git from './git.js'

type ToolInput = Record<string, unknown>
type ToolHandler = (input: ToolInput) => Promise<string> | string
type Tool = Anthropic.Tool

// --- Schemas ---

const SHARED_SCHEMAS: Tool[] = [
  {
    name: 'read_file',
    description: 'Read a file from the repository by repo-relative path.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Repo-relative path, e.g. docs/architecture.md' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file in the repository.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'github_get_issue',
    description: 'Get a GitHub issue including its body and all comments.',
    input_schema: {
      type: 'object',
      properties: { issue_number: { type: 'integer' } },
      required: ['issue_number'],
    },
  },
  {
    name: 'github_comment',
    description: 'Post a comment on a GitHub issue or PR.',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'integer' },
        body: { type: 'string' },
      },
      required: ['issue_number', 'body'],
    },
  },
  {
    name: 'github_add_label',
    description: 'Add a label to a GitHub issue or PR.',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'integer' },
        label: { type: 'string' },
      },
      required: ['issue_number', 'label'],
    },
  },
  {
    name: 'github_remove_label',
    description: 'Remove a label from a GitHub issue or PR.',
    input_schema: {
      type: 'object',
      properties: {
        issue_number: { type: 'integer' },
        label: { type: 'string' },
      },
      required: ['issue_number', 'label'],
    },
  },
]

const AGENT_SCHEMAS: Record<string, Tool[]> = {
  pm: [
    {
      name: 'github_create_milestone',
      description: 'Create a GitHub milestone.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          due_on: { type: 'string', description: 'ISO 8601 date (optional)' },
        },
        required: ['title', 'description'],
      },
    },
    {
      name: 'github_close_milestone',
      description: 'Close a completed GitHub milestone.',
      input_schema: {
        type: 'object',
        properties: { milestone_number: { type: 'integer' } },
        required: ['milestone_number'],
      },
    },
    {
      name: 'github_create_issue',
      description: 'Create a GitHub issue.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          milestone_number: { type: 'integer' },
        },
        required: ['title', 'body', 'labels'],
      },
    },
    {
      name: 'github_list_issues',
      description: 'List GitHub issues, optionally filtered by labels, milestone, or state.',
      input_schema: {
        type: 'object',
        properties: {
          labels: { type: 'array', items: { type: 'string' } },
          milestone_number: { type: 'integer' },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
        },
      },
    },
  ],
  architect: [
    {
      name: 'github_create_issue',
      description: 'Create a Feature or architectural task issue.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          milestone_number: { type: 'integer' },
        },
        required: ['title', 'body', 'labels'],
      },
    },
    {
      name: 'github_get_pr_diff',
      description: 'Get the full diff for a pull request.',
      input_schema: {
        type: 'object',
        properties: { pr_number: { type: 'integer' } },
        required: ['pr_number'],
      },
    },
    {
      name: 'github_submit_pr_review',
      description: 'Submit a PR review (APPROVE, REQUEST_CHANGES, or COMMENT).',
      input_schema: {
        type: 'object',
        properties: {
          pr_number: { type: 'integer' },
          event: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'] },
          body: { type: 'string' },
          comments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                line: { type: 'integer' },
                body: { type: 'string' },
              },
              required: ['path', 'line', 'body'],
            },
          },
        },
        required: ['pr_number', 'event', 'body'],
      },
    },
  ],
  requirements: [
    {
      name: 'github_create_issue',
      description: 'Create a Task issue.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          milestone_number: { type: 'integer' },
        },
        required: ['title', 'body', 'labels'],
      },
    },
  ],
  developer: [
    {
      name: 'git_create_branch',
      description: 'Create and check out a new git branch.',
      input_schema: {
        type: 'object',
        properties: { branch_name: { type: 'string', description: 'e.g. task/42-add-login-flow' } },
        required: ['branch_name'],
      },
    },
    {
      name: 'git_commit_and_push',
      description: 'Stage files, commit with a message, and push the branch.',
      input_schema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
        required: ['files', 'message'],
      },
    },
    {
      name: 'github_create_pr',
      description: 'Open a pull request.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          head: { type: 'string' },
          base: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'body', 'head', 'base'],
      },
    },
    {
      name: 'list_files',
      description: 'List files in a repository directory.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  ],
  tester: [
    {
      name: 'run_tests',
      description: 'Run the test suite or a specific test command and return output.',
      input_schema: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Test command to run. Defaults to TEST_COMMAND env var.' } },
      },
    },
    {
      name: 'git_commit_and_push',
      description: 'Stage test files, commit, and push to the feature branch.',
      input_schema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
        required: ['files', 'message'],
      },
    },
    {
      name: 'github_get_pr_diff',
      description: 'Get the full diff for a pull request.',
      input_schema: {
        type: 'object',
        properties: { pr_number: { type: 'integer' } },
        required: ['pr_number'],
      },
    },
  ],
  reviewer: [
    {
      name: 'github_get_pr_diff',
      description: 'Get the full diff for a pull request.',
      input_schema: {
        type: 'object',
        properties: { pr_number: { type: 'integer' } },
        required: ['pr_number'],
      },
    },
    {
      name: 'github_submit_pr_review',
      description: 'Submit a PR review with optional inline comments.',
      input_schema: {
        type: 'object',
        properties: {
          pr_number: { type: 'integer' },
          event: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'] },
          body: { type: 'string' },
          comments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                line: { type: 'integer' },
                body: { type: 'string' },
              },
              required: ['path', 'line', 'body'],
            },
          },
        },
        required: ['pr_number', 'event', 'body'],
      },
    },
  ],
}

export const getToolSchemas = (agentName: string): Tool[] =>
  [...SHARED_SCHEMAS, ...(AGENT_SCHEMAS[agentName] ?? [])]

// --- Handlers ---

const HANDLERS: Record<string, ToolHandler> = {
  read_file: ({ path }) => files.readFile(path as string),
  write_file: ({ path, content }) => files.writeFile(path as string, content as string),
  list_files: ({ path }) => files.listFiles(path as string),

  github_get_issue: ({ issue_number }) => github.getIssue(issue_number as number),
  github_comment: ({ issue_number, body }) => github.postComment(issue_number as number, body as string),
  github_add_label: ({ issue_number, label }) => github.addLabel(issue_number as number, label as string),
  github_remove_label: ({ issue_number, label }) => github.removeLabel(issue_number as number, label as string),
  github_create_milestone: ({ title, description, due_on }) =>
    github.createMilestone(title as string, description as string, due_on as string | undefined),
  github_close_milestone: ({ milestone_number }) => github.closeMilestone(milestone_number as number),
  github_create_issue: ({ title, body, labels, milestone_number }) =>
    github.createIssue(title as string, body as string, labels as string[], milestone_number as number | undefined),
  github_list_issues: ({ labels, milestone_number, state }) =>
    github.listIssues(labels as string[] | undefined, milestone_number as number | undefined, (state as 'open' | 'closed' | 'all') ?? 'open'),
  github_get_pr_diff: ({ pr_number }) => github.getPrDiff(pr_number as number),
  github_submit_pr_review: ({ pr_number, event, body, comments }) =>
    github.submitPrReview(
      pr_number as number,
      event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      body as string,
      comments as Array<{ path: string; line: number; body: string }> | undefined,
    ),
  github_create_pr: ({ title, body, head, base, labels }) =>
    github.createPr(title as string, body as string, head as string, base as string, labels as string[] | undefined),

  git_create_branch: ({ branch_name }) => git.createBranch(branch_name as string),
  git_commit_and_push: ({ files: f, message }) => git.commitAndPush(f as string[], message as string),
  run_tests: ({ command }) => git.runTests(command as string | undefined),
}

export const executeTool = async (name: string, input: ToolInput): Promise<string> => {
  const handler = HANDLERS[name]
  if (!handler) throw new Error(`Unknown tool: ${name}`)
  return handler(input)
}
