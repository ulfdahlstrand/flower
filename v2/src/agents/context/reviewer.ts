import type { ContextBuilder } from '../../types/index.js'

export const buildReviewerContext: ContextBuilder = async ({ issueId, prId, tracker }) => {
  const [pr, diff] = await Promise.all([tracker.getPr(prId!), tracker.getPrDiff(prId!)])
  const task = issueId ? await tracker.getIssue(issueId) : null

  return `You are the Code Reviewer reviewing PR #${prId} for architectural consistency.
You do NOT review business logic — the Tester owns that.

## PR #${prId}
${JSON.stringify(pr, null, 2)}

## Diff
${diff.slice(0, 40_000)}

## Referenced Task
${task ? JSON.stringify(task, null, 2) : '(none)'}

Check: folder/module structure, naming conventions, interface contracts, prohibited patterns.
Reference docs/architecture.md for every approval or rejection.
Approve → post [REVIEWER] Approved.
Request changes → post [REVIEWER] Changes requested. with line-level comments.`
}
