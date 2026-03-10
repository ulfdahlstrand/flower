import { Octokit } from '@octokit/rest'
import type {
  IssueTracker, Issue, IssueComment, PullRequest, Milestone,
  CreateIssueParams, CreatePrParams, IssueFilter,
} from '../types/index.js'

// ---------------------------------------------------------------------------
// GitHub implementation of IssueTracker.
//
// All GitHub-specific concepts are translated here:
// - "Part of #X" in body → Issue.parentId (first-class field)
// - "Closes #X" in PR body → PullRequest.linkedIssueId (first-class field)
// - GitHub label objects → string[] of names
//
// Nothing outside this file imports from @octokit/rest.
// ---------------------------------------------------------------------------

export class GitHubTracker implements IssueTracker {
  private octokit: Octokit
  private owner: string
  private repo: string

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token })
    this.owner = owner
    this.repo = repo
  }

  // -------------------------------------------------------------------------
  // Issues
  // -------------------------------------------------------------------------

  async getIssue(id: number): Promise<Issue> {
    const [{ data: issue }, { data: comments }] = await Promise.all([
      this.octokit.issues.get({ owner: this.owner, repo: this.repo, issue_number: id }),
      this.octokit.issues.listComments({ owner: this.owner, repo: this.repo, issue_number: id }),
    ])

    return {
      id: issue.number,
      title: issue.title,
      body: issue.body ?? '',
      state: issue.state === 'open' ? 'open' : 'closed',
      labels: issue.labels.map(l => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
      comments: comments.map(c => ({
        id: c.id,
        author: c.user?.login ?? 'unknown',
        authorType: c.user?.type === 'Bot' ? 'bot' : 'human',
        body: c.body ?? '',
        createdAt: c.created_at,
      } satisfies IssueComment)),
      parentId: extractParentId(issue.body ?? ''),
      milestone: issue.milestone?.title,
    }
  }

  async createIssue(params: CreateIssueParams): Promise<Issue> {
    const body = params.parentId
      ? `Part of #${params.parentId}\n\n${params.body}`
      : params.body

    const { data } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: params.title,
      body,
      labels: params.labels,
      milestone: params.milestoneId,
    })

    return {
      id: data.number,
      title: data.title,
      body: data.body ?? '',
      state: 'open',
      labels: params.labels ?? [],
      comments: [],
      parentId: params.parentId,
      milestone: params.milestoneId !== undefined ? String(params.milestoneId) : undefined,
    }
  }

  async closeIssue(id: number): Promise<void> {
    await this.octokit.issues.update({
      owner: this.owner, repo: this.repo, issue_number: id, state: 'closed',
    })
  }

  async listIssues(filter?: IssueFilter): Promise<Issue[]> {
    const { data } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      labels: filter?.labels?.join(','),
      state: filter?.state ?? 'open',
      milestone: filter?.milestone,
      per_page: 100,
    })

    return data
      .filter(i => !i.pull_request) // GitHub returns PRs in issues endpoint
      .map(i => ({
        id: i.number,
        title: i.title,
        body: i.body ?? '',
        state: i.state === 'open' ? 'open' : 'closed',
        labels: i.labels.map(l => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
        comments: [],  // not fetched in list view — call getIssue for full detail
        parentId: extractParentId(i.body ?? ''),
        milestone: i.milestone?.title,
      } satisfies Issue))
  }

  async listChildIssues(parentId: number): Promise<Issue[]> {
    // GitHub has no native parent-child — search by "Part of #X" in body
    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: `repo:${this.owner}/${this.repo} "Part of #${parentId}" is:issue`,
      per_page: 100,
    })
    return data.items.map(i => ({
      id: i.number,
      title: i.title,
      body: i.body ?? '',
      state: i.state === 'open' ? 'open' : 'closed',
      labels: i.labels.map(l => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
      comments: [],
      parentId,
    } satisfies Issue))
  }

  // -------------------------------------------------------------------------
  // Labels
  // -------------------------------------------------------------------------

  async addLabel(id: number, label: string): Promise<void> {
    await this.octokit.issues.addLabels({
      owner: this.owner, repo: this.repo, issue_number: id, labels: [label],
    })
  }

  async removeLabel(id: number, label: string): Promise<void> {
    await this.octokit.issues.removeLabel({
      owner: this.owner, repo: this.repo, issue_number: id, name: label,
    }).catch(() => {}) // ignore if label isn't present
  }

  async createLabel(name: string, color: string, description?: string): Promise<void> {
    await this.octokit.issues.createLabel({
      owner: this.owner, repo: this.repo,
      name, color: color.replace('#', ''), description,
    })
  }

  async listLabels(): Promise<Array<{ name: string; color: string }>> {
    const { data } = await this.octokit.issues.listLabelsForRepo({
      owner: this.owner, repo: this.repo, per_page: 100,
    })
    return data.map(l => ({ name: l.name, color: `#${l.color}` }))
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  async postComment(id: number, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner, repo: this.repo, issue_number: id, body,
    })
  }

  // -------------------------------------------------------------------------
  // Pull Requests
  // -------------------------------------------------------------------------

  async createPr(params: CreatePrParams): Promise<PullRequest> {
    const body = params.linkedIssueId
      ? `Closes #${params.linkedIssueId}\n\n${params.body}`
      : params.body

    const { data } = await this.octokit.pulls.create({
      owner: this.owner, repo: this.repo,
      title: params.title,
      body,
      head: params.headBranch,
      base: params.baseBranch,
    })

    return {
      id: data.number,
      title: data.title,
      body: data.body ?? '',
      state: 'open',
      headBranch: data.head.ref,
      baseBranch: data.base.ref,
      labels: [],
      linkedIssueId: params.linkedIssueId,
    }
  }

  async getPr(id: number): Promise<PullRequest> {
    const { data } = await this.octokit.pulls.get({
      owner: this.owner, repo: this.repo, pull_number: id,
    })

    return {
      id: data.number,
      title: data.title,
      body: data.body ?? '',
      state: data.merged ? 'merged' : data.state === 'open' ? 'open' : 'closed',
      headBranch: data.head.ref,
      baseBranch: data.base.ref,
      labels: data.labels.map(l => l.name ?? '').filter(Boolean),
      linkedIssueId: extractLinkedIssueId(data.body ?? ''),
    }
  }

  async getPrDiff(id: number): Promise<string> {
    const { data } = await this.octokit.pulls.get({
      owner: this.owner, repo: this.repo, pull_number: id,
      mediaType: { format: 'diff' },
    })
    return data as unknown as string
  }

  // -------------------------------------------------------------------------
  // Milestones
  // -------------------------------------------------------------------------

  async createMilestone(title: string, description: string): Promise<Milestone> {
    const { data } = await this.octokit.issues.createMilestone({
      owner: this.owner, repo: this.repo, title, description,
    })
    return { id: data.number, title: data.title, description: data.description ?? '', state: 'open' }
  }

  async closeMilestone(id: number): Promise<void> {
    await this.octokit.issues.updateMilestone({
      owner: this.owner, repo: this.repo, milestone_number: id, state: 'closed',
    })
  }
}

// ---------------------------------------------------------------------------
// Private helpers — GitHub-specific body parsing, contained here only
// ---------------------------------------------------------------------------

const extractParentId = (body: string): number | undefined => {
  const match = body.match(/Part of #(\d+)/i)
  return match ? parseInt(match[1]!, 10) : undefined
}

const extractLinkedIssueId = (body: string): number | undefined => {
  const match = body.match(/(?:Closes|Fixes|Resolves)\s+#(\d+)/i)
  return match ? parseInt(match[1]!, 10) : undefined
}
