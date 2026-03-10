import type { ContextBuilder } from '../../types/index.js'

export const buildArchitectContext: ContextBuilder = async ({ issueId, prId, stage, tracker, taskState }) => {
  if (stage === 'code_review' && prId) {
    const [pr, diff] = await Promise.all([tracker.getPr(prId), tracker.getPrDiff(prId)])
    const task = issueId ? await tracker.getIssue(issueId) : null
    return `You are the Architect reviewing PR #${prId} for architectural consistency.

## PR #${prId}
${JSON.stringify(pr, null, 2)}

## Diff
${diff.slice(0, 40_000)}

## Referenced Task
${task ? JSON.stringify(task, null, 2) : '(none)'}

Check folder structure, naming conventions, interface contracts, and prohibited patterns
against docs/architecture.md. Post [ARCHITECT] Approved or [ARCHITECT] Changes requested.`
  }

  const issue = await tracker.getIssue(issueId!)
  const parentIssue = issue.parentId ? await tracker.getIssue(issue.parentId) : null

  if (stage === 'feature_review') {
    return `You are the Architect reviewing Feature #${issueId} for architectural fit.

## Feature #${issueId}
${JSON.stringify(issue, null, 2)}

## Parent Epic
${parentIssue ? JSON.stringify(parentIssue, null, 2) : '(no parent)'}

Approve, approve with notes, or flag a gap. Post @agent:requirements to hand back.`
  }

  // task_architecture_review
  return `You are the Architect reviewing Task #${issueId} for architectural fit.

## Task #${issueId}
${JSON.stringify(issue, null, 2)}

## Task State
${taskState ? JSON.stringify(taskState, null, 2) : '(none)'}

Approve → post @agent:tester. Block → create an architectural task and post @agent:requirements.`
}
