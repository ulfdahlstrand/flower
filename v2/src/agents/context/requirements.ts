import type { ContextBuilder } from '../../types/index.js'

export const buildRequirementsContext: ContextBuilder = async ({ issueId, stage, tracker }) => {
  const issue = await tracker.getIssue(issueId!)
  const parentIssue = issue.parentId ? await tracker.getIssue(issue.parentId) : null

  if (stage === 'epic_breakdown') {
    return `You are the Requirements Specialist breaking down Epic #${issueId} into Feature issues.

## Epic #${issueId}
${JSON.stringify(issue, null, 2)}

Follow your workflow: identify 2–6 distinct user-facing capabilities, create a Feature issue for each,
then request Architect review by posting @agent:architect on each feature.`
  }

  return `You are the Requirements Specialist defining Task issues for Feature #${issueId}.

## Feature #${issueId}
${JSON.stringify(issue, null, 2)}

## Parent Epic
${parentIssue ? JSON.stringify(parentIssue, null, 2) : '(no parent)'}

Follow your workflow: check for duplicates, draft the task with binary acceptance criteria,
write tasks/{id}.json, then request Architect review with @agent:architect.`
}
