import { registerTool } from './index.js'

// All GitHub tools go through the IssueTracker interface — no Octokit here.

registerTool({
  name: 'github_get_issue',
  description: 'Get a GitHub issue by number, including its body, labels, and comments.',
  inputSchema: { type: 'object', properties: { issue_number: { type: 'number' } }, required: ['issue_number'] },
  async execute({ issue_number }: { issue_number: number }, { tracker }) {
    const issue = await tracker.getIssue(issue_number)
    return JSON.stringify(issue, null, 2)
  },
})

registerTool({
  name: 'github_list_issues',
  description: 'List issues. Optionally filter by labels (array of strings) and state (open/closed/all).',
  inputSchema: {
    type: 'object',
    properties: {
      labels: { type: 'array', items: { type: 'string' } },
      state: { type: 'string', enum: ['open', 'closed', 'all'] },
    },
  },
  async execute({ labels, state }: { labels?: string[]; state?: 'open' | 'closed' | 'all' }, { tracker }) {
    const issues = await tracker.listIssues({ labels, state })
    return JSON.stringify(issues, null, 2)
  },
})

registerTool({
  name: 'github_list_child_issues',
  description: 'List all issues that are children of the given parent issue number.',
  inputSchema: { type: 'object', properties: { parent_number: { type: 'number' } }, required: ['parent_number'] },
  async execute({ parent_number }: { parent_number: number }, { tracker }) {
    const issues = await tracker.listChildIssues(parent_number)
    return JSON.stringify(issues, null, 2)
  },
})

registerTool({
  name: 'github_create_issue',
  description: 'Create a new GitHub issue.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      labels: { type: 'array', items: { type: 'string' } },
      parent_number: { type: 'number', description: 'Parent issue number (creates "Part of #X" link)' },
      milestone_id: { type: 'number' },
    },
    required: ['title', 'body'],
  },
  async execute({ title, body, labels, parent_number, milestone_id }: {
    title: string; body: string; labels?: string[]
    parent_number?: number; milestone_id?: number
  }, { tracker }) {
    const issue = await tracker.createIssue({ title, body, labels, parentId: parent_number, milestoneId: milestone_id })
    return JSON.stringify({ number: issue.id, title: issue.title })
  },
})

registerTool({
  name: 'github_close_issue',
  description: 'Close a GitHub issue.',
  inputSchema: { type: 'object', properties: { issue_number: { type: 'number' } }, required: ['issue_number'] },
  async execute({ issue_number }: { issue_number: number }, { tracker }) {
    await tracker.closeIssue(issue_number)
    return `Closed #${issue_number}`
  },
})

registerTool({
  name: 'github_post_comment',
  description: 'Post a comment on a GitHub issue.',
  inputSchema: {
    type: 'object',
    properties: { issue_number: { type: 'number' }, body: { type: 'string' } },
    required: ['issue_number', 'body'],
  },
  async execute({ issue_number, body }: { issue_number: number; body: string }, { tracker }) {
    await tracker.postComment(issue_number, body)
    return `Comment posted on #${issue_number}`
  },
})

registerTool({
  name: 'github_add_label',
  description: 'Add a label to a GitHub issue.',
  inputSchema: {
    type: 'object',
    properties: { issue_number: { type: 'number' }, label: { type: 'string' } },
    required: ['issue_number', 'label'],
  },
  async execute({ issue_number, label }: { issue_number: number; label: string }, { tracker }) {
    await tracker.addLabel(issue_number, label)
    return `Added label "${label}" to #${issue_number}`
  },
})

registerTool({
  name: 'github_remove_label',
  description: 'Remove a label from a GitHub issue.',
  inputSchema: {
    type: 'object',
    properties: { issue_number: { type: 'number' }, label: { type: 'string' } },
    required: ['issue_number', 'label'],
  },
  async execute({ issue_number, label }: { issue_number: number; label: string }, { tracker }) {
    await tracker.removeLabel(issue_number, label)
    return `Removed label "${label}" from #${issue_number}`
  },
})

registerTool({
  name: 'github_list_labels',
  description: 'List all labels in the repository.',
  inputSchema: { type: 'object', properties: {} },
  async execute(_input, { tracker }) {
    const labels = await tracker.listLabels()
    return JSON.stringify(labels, null, 2)
  },
})

registerTool({
  name: 'github_create_label',
  description: 'Create a new label in the repository.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      color: { type: 'string', description: 'Hex color without #, e.g. "7057ff"' },
      description: { type: 'string' },
    },
    required: ['name', 'color'],
  },
  async execute({ name, color, description }: { name: string; color: string; description?: string }, { tracker }) {
    await tracker.createLabel(name, color, description)
    return `Created label "${name}"`
  },
})

registerTool({
  name: 'github_create_pr',
  description: 'Open a pull request.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      head_branch: { type: 'string' },
      base_branch: { type: 'string', description: 'Target branch, usually "main"' },
      linked_issue: { type: 'number', description: 'Issue number this PR closes' },
    },
    required: ['title', 'body', 'head_branch', 'base_branch'],
  },
  async execute({ title, body, head_branch, base_branch, linked_issue }: {
    title: string; body: string; head_branch: string; base_branch: string; linked_issue?: number
  }, { tracker }) {
    const pr = await tracker.createPr({ title, body, headBranch: head_branch, baseBranch: base_branch, linkedIssueId: linked_issue })
    return JSON.stringify({ number: pr.id, title: pr.title })
  },
})

registerTool({
  name: 'github_get_pr',
  description: 'Get a pull request by number.',
  inputSchema: { type: 'object', properties: { pr_number: { type: 'number' } }, required: ['pr_number'] },
  async execute({ pr_number }: { pr_number: number }, { tracker }) {
    const pr = await tracker.getPr(pr_number)
    return JSON.stringify(pr, null, 2)
  },
})

registerTool({
  name: 'github_get_pr_diff',
  description: 'Get the diff for a pull request.',
  inputSchema: { type: 'object', properties: { pr_number: { type: 'number' } }, required: ['pr_number'] },
  async execute({ pr_number }: { pr_number: number }, { tracker }) {
    return tracker.getPrDiff(pr_number)
  },
})

registerTool({
  name: 'github_create_milestone',
  description: 'Create a milestone.',
  inputSchema: {
    type: 'object',
    properties: { title: { type: 'string' }, description: { type: 'string' } },
    required: ['title', 'description'],
  },
  async execute({ title, description }: { title: string; description: string }, { tracker }) {
    const m = await tracker.createMilestone(title, description)
    return JSON.stringify({ id: m.id, title: m.title })
  },
})

registerTool({
  name: 'github_close_milestone',
  description: 'Close a milestone.',
  inputSchema: { type: 'object', properties: { milestone_id: { type: 'number' } }, required: ['milestone_id'] },
  async execute({ milestone_id }: { milestone_id: number }, { tracker }) {
    await tracker.closeMilestone(milestone_id)
    return `Closed milestone ${milestone_id}`
  },
})
