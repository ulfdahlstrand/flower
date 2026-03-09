import type Anthropic from '@anthropic-ai/sdk'
import * as github from './github.js'

const GITHUB_CLOSE_ISSUE_SCHEMA: Tool = {
  name: 'github_close_issue',
  description: 'Close a GitHub issue.',
  input_schema: {
    type: 'object',
    properties: { issue_number: { type: 'integer' } },
    required: ['issue_number'],
  },
}

const GITHUB_LIST_CHILD_ISSUES_SCHEMA: Tool = {
  name: 'github_list_child_issues',
  description: 'List all issues that reference a parent issue with "Part of #<number>" in their body.',
  input_schema: {
    type: 'object',
    properties: { parent_issue_number: { type: 'integer' } },
    required: ['parent_issue_number'],
  },
}
import * as files from './files.js'
import * as git from './git.js'

type ToolInput = Record<string, unknown>
type ToolHandler = (input: ToolInput) => Promise<string> | string
type Tool = Anthropic.Tool

// --- Schemas ---

const GITHUB_UPDATE_ISSUE_SCHEMA: Tool = {
  name: 'github_update_issue',
  description: 'Update the title and/or body of a GitHub issue.',
  input_schema: {
    type: 'object',
    properties: {
      issue_number: { type: 'integer' },
      title: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['issue_number'],
  },
}

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
  po: [
    GITHUB_CLOSE_ISSUE_SCHEMA,
    {
      name: 'github_create_issue',
      description: 'Create an Epic, Feature, or Task issue once the feature request is fully understood.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'body', 'labels'],
      },
    },
    {
      name: 'github_list_issues',
      description: 'List issues to check for duplicates before creating a new one.',
      input_schema: {
        type: 'object',
        properties: {
          labels: { type: 'array', items: { type: 'string' } },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
        },
      },
    },
  ],
  pm: [
    GITHUB_CLOSE_ISSUE_SCHEMA,
    GITHUB_LIST_CHILD_ISSUES_SCHEMA,
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
      name: 'github_list_labels',
      description: 'List all labels currently defined in the repository.',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'github_create_label',
      description: 'Create a new label in the repository.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string', description: 'Hex color without #, e.g. "7057ff"' },
          description: { type: 'string' },
        },
        required: ['name', 'color', 'description'],
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
      name: 'git_create_branch',
      description: 'Fetch origin/main, reset local main to it, then create and check out a new branch. Use branch name pattern: arch/{issue-id}-short-description',
      input_schema: {
        type: 'object',
        properties: { branch_name: { type: 'string' } },
        required: ['branch_name'],
      },
    },
    {
      name: 'git_commit_and_push',
      description: 'Stage files, commit with a message, and push the branch. Only commit files under docs/.',
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
    GITHUB_UPDATE_ISSUE_SCHEMA,
    {
      name: 'github_list_issues',
      description: 'List GitHub issues (all states) to check for duplicates before creating a task.',
      input_schema: {
        type: 'object',
        properties: {
          labels: { type: 'array', items: { type: 'string' } },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
        },
      },
    },
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
      description: 'Fetch origin/main, reset local main to it, then create and check out a new feature branch. MUST be called before any git_commit_and_push.',
      input_schema: {
        type: 'object',
        properties: { branch_name: { type: 'string', description: 'e.g. task/42-add-login-flow' } },
        required: ['branch_name'],
      },
    },
    {
      name: 'git_checkout_branch',
      description: 'Fetch and check out an existing remote branch.',
      input_schema: {
        type: 'object',
        properties: { branch_name: { type: 'string' } },
        required: ['branch_name'],
      },
    },
    {
      name: 'git_commit_and_push',
      description: 'Stage files, commit with a message, and push the branch. Refuses if current branch is main.',
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
      name: 'git_checkout_branch',
      description: 'Fetch and check out an existing remote branch (use to get onto the feature branch before writing tests).',
      input_schema: {
        type: 'object',
        properties: { branch_name: { type: 'string' } },
        required: ['branch_name'],
      },
    },
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
  github_close_issue: ({ issue_number }) => github.closeIssue(issue_number as number),
  github_list_child_issues: ({ parent_issue_number }) => github.listChildIssues(parent_issue_number as number),
  github_update_issue: ({ issue_number, title, body }) =>
    github.updateIssue(issue_number as number, { title: title as string | undefined, body: body as string | undefined }),
  github_comment: ({ issue_number, body }) => github.postComment(issue_number as number, body as string),
  github_add_label: ({ issue_number, label }) => github.addLabel(issue_number as number, label as string),
  github_remove_label: ({ issue_number, label }) => github.removeLabel(issue_number as number, label as string),
  github_list_labels: () => github.listLabels(),
  github_create_label: ({ name, color, description }) =>
    github.createLabel(name as string, color as string, description as string),
  github_create_milestone: ({ title, description, due_on }) =>
    github.createMilestone(title as string, description as string, due_on as string | undefined),
  github_close_milestone: ({ milestone_number }) => github.closeMilestone(milestone_number as number),
  github_create_issue: ({ title, body, labels, milestone_number }) =>
    github.createIssue(title as string, body as string, labels as string[], milestone_number as number | undefined),
  github_list_issues: ({ labels, milestone_number, state }) =>
    github.listIssues(labels as string[] | undefined, milestone_number as number | undefined, (state as 'open' | 'closed' | 'all') ?? 'open'),
  github_get_pr: ({ pr_number }) => github.getPr(pr_number as number),
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
  git_checkout_branch: ({ branch_name }) => git.checkoutBranch(branch_name as string),
  git_commit_and_push: ({ files: f, message }) => git.commitAndPush(f as string[], message as string),

  run_tests: ({ command }) => git.runTests(command as string | undefined),
}

export const executeTool = async (name: string, input: ToolInput): Promise<string> => {
  const handler = HANDLERS[name]
  if (!handler) throw new Error(`Unknown tool: ${name}`)
  return handler(input)
}
