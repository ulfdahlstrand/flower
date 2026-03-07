import fs from 'node:fs'
import path from 'node:path'
import { anthropic } from './config.js'
import { enqueueAgent, isAgentPendingForPr } from './queue.js'
import { addLabel, removeLabel, closeIssue, fetchAllIssues, listChildIssues, postComment, getPrMeta } from './tools/github.js'
import { readFile, writeFile } from './tools/files.js'
import { loadSession, clearSession } from './session.js'
import { REPO_PATH } from './config.js'
import type { InvocationParams } from './types.js'

const isRetestRequest = async (comment: string): Promise<boolean> => {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16,
    messages: [{
      role: 'user',
      content: `Does this comment ask the team to re-run tests or retest? Reply with only YES or NO.\n\nComment: "${comment}"`,
    }],
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
  return text.toUpperCase().startsWith('YES')
}

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

export const runStartupCascadeCheck = async (): Promise<void> => {
  console.log('[startup] Running cascade close check...')

  const allIssues = await fetchAllIssues()

  // Build parent → children map from "Part of #X" in issue bodies
  const childrenByParent = new Map<number, typeof allIssues>()
  for (const issue of allIssues) {
    const match = issue.body?.match(/Part of #(\d+)/i)
    if (!match) continue
    const parentNumber = parseInt(match[1], 10)
    const existing = childrenByParent.get(parentNumber) ?? []
    existing.push(issue)
    childrenByParent.set(parentNumber, existing)
  }

  // Close any open parent whose children are all closed
  for (const [parentNumber, children] of childrenByParent) {
    const parent = allIssues.find(i => i.number === parentNumber)
    if (!parent || parent.state !== 'open') continue
    if (children.length === 0) continue
    if (children.every(c => c.state === 'closed')) {
      console.log(`[startup] #${parentNumber} has all children closed — closing`)
      await closeIssue(parentNumber)
      await postComment(parentNumber, '[PM] All child issues are complete. Closing.')
    }
  }

  console.log('[startup] Cascade close check complete')
}

export const routeIssueLabeled = async (issue: Issue, addedLabel: string): Promise<void> => {
  const labels = labelNames(issue.labels)

  // PM label on an epic: hand off to Architect — no LLM reasoning needed
  if (addedLabel === 'agent:pm' && labels.includes('type:epic')) {
    console.log(`[router] Epic #${issue.number} assigned to PM — redirecting to Architect`)
    await removeLabel(issue.number, 'agent:pm')
    await addLabel(issue.number, 'agent:architect')
    await postComment(issue.number, '[PM] Epic received. Assigning to Architect for feature breakdown.')
    return
  }

  const params = resolveIssueParams(issue.number, labels, addedLabel)
  if (!params) {
    console.log(`[router] No agent route for issue #${issue.number} with label "${addedLabel}"`)
    return
  }
  console.log(`[router] Enqueueing ${params.agent} for issue #${issue.number}`)
  enqueueAgent(params)
}

export const routePrMerged = async (prNumber: number, body?: string): Promise<void> => {
  const taskNumber = extractIssueRef(body)
  if (!taskNumber) {
    console.log(`[router] PR #${prNumber} merged — no task ref in body, skipping`)
    return
  }

  console.log(`[router] PR #${prNumber} merged — closing task #${taskNumber}`)

  // Update tasks/{id}.json status to complete
  try {
    const raw = readFile(`tasks/${taskNumber}.json`)
    const taskState = JSON.parse(raw)
    taskState.status = 'complete'
    taskState.conversation_log = [
      ...(taskState.conversation_log ?? []),
      {
        agent: 'orchestrator',
        timestamp: new Date().toISOString(),
        action: 'pr_merged',
        summary: `PR #${prNumber} merged. Task complete.`,
      },
    ]
    writeFile(`tasks/${taskNumber}.json`, JSON.stringify(taskState, null, 2))
  } catch {
    console.warn(`[router] Could not update tasks/${taskNumber}.json — file may not exist`)
  }

  // Apply status:done label (GitHub auto-closes the issue via "Closes #X")
  await addLabel(taskNumber, 'status:done').catch(err =>
    console.error(`[router] Failed to add status:done to #${taskNumber}:`, err),
  )
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
  console.log(`[router] Comment on #${issue.number} — enqueueing ${params.agent}`)
  enqueueAgent({ ...params, humanComment: commentBody })
}

export const routePrComment = async (pr: PullRequest & { body?: string }, commentBody: string): Promise<void> => {
  const labels = labelNames(pr.labels)

  if (!labels.includes('agent:developer') && !labels.includes('agent:tester')) {
    console.log(`[router] PR #${pr.number} comment — no agent:developer or agent:tester label, ignoring`)
    return
  }

  const shouldRetest = await isRetestRequest(commentBody)
  if (!shouldRetest) {
    console.log(`[router] PR #${pr.number} comment — not a retest request, ignoring`)
    return
  }

  const taskNumber = extractIssueRef(pr.body)

  if (labels.includes('agent:developer')) {
    console.log(`[router] PR #${pr.number} comment — swapping agent:developer → agent:tester and re-running`)
    await removeLabel(pr.number, 'agent:developer')
    await addLabel(pr.number, 'agent:tester')
    const params: InvocationParams = { agent: 'tester', prNumber: pr.number, issueNumber: taskNumber, testerMode: 'post_dev' }
    clearSession(params)
    enqueueAgent(params)
    return
  }

  if (labels.includes('agent:tester')) {
    console.log(`[router] PR #${pr.number} comment — re-running tester`)
    const params: InvocationParams = { agent: 'tester', prNumber: pr.number, issueNumber: taskNumber, testerMode: 'post_dev' }
    clearSession(params)
    enqueueAgent(params)
    return
  }
}

// Called when a GitHub check suite completes on a PR.
// If all checks passed, trigger the reviewer — CI is the gate, not the Tester agent.
export const routeCheckSuiteCompleted = async (conclusion: string, prNumbers: number[]): Promise<void> => {
  if (conclusion !== 'success') {
    console.log(`[router] Check suite concluded ${conclusion} — not triggering reviewer`)
    return
  }
  for (const prNumber of prNumbers) {
    const pr = await getPrMeta(prNumber)
    if (pr.state !== 'open') {
      console.log(`[router] PR #${prNumber} is not open — skipping`)
      continue
    }
    if (isAgentPendingForPr('reviewer', prNumber)) {
      console.log(`[router] PR #${prNumber} reviewer already queued — skipping`)
      continue
    }
    const taskNumber = extractIssueRef(pr.body ?? undefined)
    console.log(`[router] CI passed for PR #${prNumber} — triggering reviewer`)
    const agentLabels = pr.labels.filter(l => l.startsWith('agent:'))
    await Promise.all(agentLabels.map(l => removeLabel(prNumber, l)))
    await addLabel(prNumber, 'agent:reviewer')
    enqueueAgent({ agent: 'reviewer', prNumber, issueNumber: taskNumber })
  }
}

export const routePrLabeled = async (pr: PullRequest, addedLabel: string): Promise<void> => {
  const params = resolvePrParams(pr, addedLabel)
  if (!params) {
    console.log(`[router] No agent route for PR #${pr.number} with label "${addedLabel}"`)
    return
  }
  console.log(`[router] Enqueueing ${params.agent} for PR #${pr.number}`)
  enqueueAgent(params)
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
  if (addedLabel === 'agent:architect' && isTask) {
    // Distinguish architect's own architectural tasks (no tasks/{id}.json) from requirements-reviewed tasks (have tasks/{id}.json)
    const hasTaskFile = fs.existsSync(path.resolve(REPO_PATH, `tasks/${issueNumber}.json`))
    return { agent: 'architect', issueNumber, architectMode: hasTaskFile ? 'task_review' : 'architectural_task' }
  }
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
