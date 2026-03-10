// ---------------------------------------------------------------------------
// Issue Tracker abstraction
// Implementations: GitHub, Jira, Linear, ...
// ---------------------------------------------------------------------------

export interface Issue {
  id: number
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
  comments: IssueComment[]
  parentId?: number      // "Part of #X" — first-class, not parsed from body
  milestone?: string
}

export interface IssueComment {
  id: number
  author: string
  authorType: 'human' | 'bot'
  body: string
  createdAt: string
}

export interface PullRequest {
  id: number
  title: string
  body: string
  state: 'open' | 'closed' | 'merged'
  headBranch: string
  baseBranch: string
  labels: string[]
  linkedIssueId?: number  // "Closes #X" — first-class, not parsed from body
}

export interface Milestone {
  id: number
  title: string
  description: string
  state: 'open' | 'closed'
}

export interface CreateIssueParams {
  title: string
  body: string
  labels?: string[]
  milestoneId?: number
  parentId?: number
}

export interface CreatePrParams {
  title: string
  body: string
  headBranch: string
  baseBranch: string
  linkedIssueId?: number
}

export interface IssueFilter {
  labels?: string[]
  state?: 'open' | 'closed' | 'all'
  milestone?: string
}

// The contract every tracker implementation must satisfy.
// Nothing above this layer imports from @octokit, jira-client, etc.
export interface IssueTracker {
  // Issues
  getIssue(id: number): Promise<Issue>
  createIssue(params: CreateIssueParams): Promise<Issue>
  closeIssue(id: number): Promise<void>
  listIssues(filter?: IssueFilter): Promise<Issue[]>
  listChildIssues(parentId: number): Promise<Issue[]>

  // Labels
  addLabel(id: number, label: string): Promise<void>
  removeLabel(id: number, label: string): Promise<void>
  createLabel(name: string, color: string, description?: string): Promise<void>
  listLabels(): Promise<Array<{ name: string; color: string }>>

  // Comments
  postComment(id: number, body: string): Promise<void>

  // Pull requests
  createPr(params: CreatePrParams): Promise<PullRequest>
  getPr(id: number): Promise<PullRequest>
  getPrDiff(id: number): Promise<string>

  // Milestones
  createMilestone(title: string, description: string): Promise<Milestone>
  closeMilestone(id: number): Promise<void>
}
