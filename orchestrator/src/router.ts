import { runAgent } from './loop.js'
import { closeIssue, listChildIssues, postComment } from './tools/github.js'
import { loadSession } from './session.js'
import type { InvocationParams } from './types.js'

type Label = { name?: string }
type Issue = { number: number; labels: Label[] }
type PullRequest = { number: number; labels: Label[]; body?: string }

const labelNames = (labels: Label[]): string[] =>
  labels.map(l => l.name ?? '').filter(Boolean)

// Extract the task issue number from a PR body ("Closes #42" or "Part of #42")
const extractIssueRef = (body?: string): number | undefined => {
  if (!body) return undefined
  const match = body.match(/(?:Closes|Fixes|Resolves|Part of)\s+#(\d+)/i)
  return match ? parseInt(match[1], 10) : undefined
}

export const routeIssueLabeled = async (issue: Issue, addedLabel: string): Promise<void> => {
  const labels = labelNames(issue.labels)
  const params = resolveIssueParams(issue.number, labels, addedLabel)
  if (!params) {
    console.log(`[router] No agent route for issue #${issue.number} with label "${addedLabel}"`)
    return
  }
  console.log(`[router] Dispatching ${params.agent} for issue #${issue.number}`)
  await runAgent(params)
}

export const routeIssueClosed = async (issueNumber: number, body?: string): Promise<void> => {
  const parentMatch = body?.match(/Part of #(\d+)/i)
  if (!parentMatch) return

  const parentNumber = parseInt(parentMatch[1], 10)
  const siblingsRaw = await listChildIssues(parentNumber)
  const siblings = JSON.parse(siblingsRaw) as Array<{ number: number; state: string }>

  const openSiblings = siblings.filter(s => s.state === 'open' && s.number !== issueNumber)
  if (openSiblings.length > 0) {
    console.log(`[router] #${parentNumber} still has ${openSiblings.length} open child(ren) — not closing`)
    return
  }

  console.log(`[router] All children of #${parentNumber} closed — closing parent`)
  await closeIssue(parentNumber)
  await postComment(parentNumber, '[PM] All child issues are complete. Closing.')
}

export const routeIssueComment = async (issue: Issue, commentBody: string): Promise<void> => {
  const labels = labelNames(issue.labels)
  const agentLabel = labels.find(l => l.startsWith('agent:'))
  if (!agentLabel) {
    console.log(`[router] No active agent label on issue #${issue.number} — ignoring comment`)
    return
  }
  const params = resolveIssueParams(issue.number, labels, agentLabel)
  if (!params) {
    console.log(`[router] No agent route for issue #${issue.number} with label "${agentLabel}"`)
    return
  }
  const existingSession = loadSession(params)
  if (existingSession && !/continue/i.test(commentBody)) {
    console.log(`[router] Session paused for #${issue.number} — comment must include "continue" to resume`)
    return
  }
  console.log(`[router] Comment on #${issue.number} — re-invoking ${params.agent}`)
  await runAgent({ ...params, humanComment: commentBody })
}

export const routePrLabeled = async (pr: PullRequest, addedLabel: string): Promise<void> => {
  const params = resolvePrParams(pr, addedLabel)
  if (!params) {
    console.log(`[router] No agent route for PR #${pr.number} with label "${addedLabel}"`)
    return
  }
  console.log(`[router] Dispatching ${params.agent} for PR #${pr.number}`)
  await runAgent(params)
}

const resolveIssueParams = (
  issueNumber: number,
  currentLabels: string[],
  addedLabel: string,
): InvocationParams | null => {
  const isEpic = currentLabels.includes('type:epic')
  const isFeature = currentLabels.includes('type:feature')
  const isTask = currentLabels.includes('type:task')

  if (addedLabel === 'agent:architect' && isEpic) return { agent: 'architect', issueNumber, architectMode: 'epic_breakdown' }
  if (addedLabel === 'agent:architect' && isTask) return { agent: 'architect', issueNumber, architectMode: 'task_review' }
  if (addedLabel === 'agent:requirements' && isFeature) return { agent: 'requirements', issueNumber, requirementsMode: 'feature' }
  if (addedLabel === 'agent:requirements' && isTask) return { agent: 'requirements', issueNumber, requirementsMode: 'task_revision' }
  if (addedLabel === 'agent:developer' && isTask) return { agent: 'developer', issueNumber }
  if (addedLabel === 'agent:tester' && isTask) return { agent: 'tester', issueNumber, testerMode: 'pre_dev' }
  return null
}

const resolvePrParams = (pr: PullRequest, addedLabel: string): InvocationParams | null => {
  const taskNumber = extractIssueRef(pr.body)
  if (addedLabel === 'agent:reviewer') return { agent: 'reviewer', prNumber: pr.number, issueNumber: taskNumber }
  if (addedLabel === 'agent:tester') return { agent: 'tester', prNumber: pr.number, issueNumber: taskNumber, testerMode: 'post_dev' }
  return null
}
