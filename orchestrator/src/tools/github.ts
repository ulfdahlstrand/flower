import { octokit, OWNER, REPO } from '../config.js'

export const getIssue = async (issueNumber: number): Promise<string> => {
  const { data: issue } = await octokit.issues.get({ owner: OWNER, repo: REPO, issue_number: issueNumber })
  const { data: comments } = await octokit.issues.listComments({ owner: OWNER, repo: REPO, issue_number: issueNumber })
  return JSON.stringify({
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels.map(l => (typeof l === 'string' ? l : l.name)),
    milestone: issue.milestone?.title ?? null,
    state: issue.state,
    comments: comments.map(c => ({ author: c.user?.login, body: c.body, created_at: c.created_at })),
  })
}

export const postComment = async (issueNumber: number, body: string): Promise<string> => {
  const { data } = await octokit.issues.createComment({ owner: OWNER, repo: REPO, issue_number: issueNumber, body })
  return `Comment posted: ${data.html_url}`
}

export const addLabel = async (issueNumber: number, label: string): Promise<string> => {
  await octokit.issues.addLabels({ owner: OWNER, repo: REPO, issue_number: issueNumber, labels: [label] })
  return `Label "${label}" added to #${issueNumber}`
}

export const removeLabel = async (issueNumber: number, label: string): Promise<string> => {
  await octokit.issues.removeLabel({ owner: OWNER, repo: REPO, issue_number: issueNumber, name: label })
  return `Label "${label}" removed from #${issueNumber}`
}

export const createMilestone = async (title: string, description: string, due_on?: string): Promise<string> => {
  const { data } = await octokit.issues.createMilestone({ owner: OWNER, repo: REPO, title, description, due_on })
  return `Milestone created: #${data.number} "${data.title}"`
}

export const closeMilestone = async (milestoneNumber: number): Promise<string> => {
  await octokit.issues.updateMilestone({ owner: OWNER, repo: REPO, milestone_number: milestoneNumber, state: 'closed' })
  return `Milestone #${milestoneNumber} closed`
}

export const closeIssue = async (issueNumber: number): Promise<string> => {
  await octokit.issues.update({ owner: OWNER, repo: REPO, issue_number: issueNumber, state: 'closed' })
  return `Issue #${issueNumber} closed`
}

export const fetchAllIssues = async (): Promise<Array<{ number: number; state: string; body: string | null }>> => {
  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner: OWNER,
    repo: REPO,
    state: 'all',
    per_page: 100,
  })
  return issues
    .filter(i => !i.pull_request)
    .map(i => ({ number: i.number, state: i.state, body: i.body ?? null }))
}

export const listChildIssues = async (parentNumber: number): Promise<string> => {
  const { data } = await octokit.issues.listForRepo({
    owner: OWNER,
    repo: REPO,
    state: 'all',
    per_page: 100,
  })
  const children = data
    .filter(i => !i.pull_request && i.body?.includes(`Part of #${parentNumber}`))
  return JSON.stringify(children.map(i => ({
    number: i.number,
    title: i.title,
    state: i.state,
    labels: i.labels.map(l => (typeof l === 'string' ? l : l.name)),
  })))
}

export const updateIssue = async (
  issueNumber: number,
  fields: { title?: string; body?: string },
): Promise<string> => {
  await octokit.issues.update({ owner: OWNER, repo: REPO, issue_number: issueNumber, ...fields })
  return `Issue #${issueNumber} updated`
}

export const createIssue = async (
  title: string,
  body: string,
  labels: string[],
  milestoneNumber?: number,
): Promise<string> => {
  const { data } = await octokit.issues.create({
    owner: OWNER,
    repo: REPO,
    title,
    body,
    labels,
    milestone: milestoneNumber,
  })
  return `Issue created: #${data.number} "${data.title}" — ${data.html_url}`
}

export const listIssues = async (
  labels?: string[],
  milestoneNumber?: number,
  state: 'open' | 'closed' | 'all' = 'open',
): Promise<string> => {
  const { data } = await octokit.issues.listForRepo({
    owner: OWNER,
    repo: REPO,
    labels: labels?.join(','),
    milestone: milestoneNumber?.toString(),
    state,
    per_page: 100,
  })
  return JSON.stringify(data.map(i => ({
    number: i.number,
    title: i.title,
    labels: i.labels.map(l => (typeof l === 'string' ? l : l.name)),
    state: i.state,
    milestone: i.milestone?.title ?? null,
  })))
}

export const getPr = async (prNumber: number): Promise<string> => {
  const { data } = await octokit.pulls.get({ owner: OWNER, repo: REPO, pull_number: prNumber })
  return JSON.stringify({
    number: data.number,
    title: data.title,
    body: data.body,
    state: data.state,
    head_branch: data.head.ref,
    base_branch: data.base.ref,
    labels: data.labels.map(l => l.name),
  })
}

export const getPrDiff = async (prNumber: number): Promise<string> => {
  const { data } = await octokit.pulls.get({
    owner: OWNER,
    repo: REPO,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  })
  return data as unknown as string
}

export const submitPrReview = async (
  prNumber: number,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  body: string,
  comments?: Array<{ path: string; line: number; body: string }>,
): Promise<string> => {
  const { data } = await octokit.pulls.createReview({
    owner: OWNER,
    repo: REPO,
    pull_number: prNumber,
    event,
    body,
    comments,
  })
  return `PR review submitted: ${data.html_url}`
}

export const createPr = async (
  title: string,
  body: string,
  head: string,
  base: string,
  labels?: string[],
): Promise<string> => {
  const { data } = await octokit.pulls.create({ owner: OWNER, repo: REPO, title, body, head, base })
  if (labels?.length) {
    await octokit.issues.addLabels({ owner: OWNER, repo: REPO, issue_number: data.number, labels })
  }
  return `PR created: #${data.number} "${data.title}" — ${data.html_url}`
}
