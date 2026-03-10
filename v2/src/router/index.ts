// ---------------------------------------------------------------------------
// Router — maps PipelineEvents to Invocations using the pipeline definition.
//
// The router is the only place that knows about event types. It never
// hardcodes agent-specific logic — it uses the declarative pipeline to
// determine who should run next.
// ---------------------------------------------------------------------------

import type { PipelineEvent, Invocation, IssueTracker } from '../types/index.js'
import { getStageByLabel } from '../pipeline/definition.js'

export const route = async (
  event: PipelineEvent,
  tracker: IssueTracker,
): Promise<Invocation[]> => {
  switch (event.type) {
    case 'issue_labeled':
      return routeIssueLabeled(event)
    case 'comment_created':
      return routeCommentCreated(event, tracker)
    case 'issue_closed':
      return routeIssueClosed(event)
    case 'ci_completed':
      return routeCiCompleted(event, tracker)
    case 'pr_merged':
      return routePrMerged(event, tracker)
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// A label was added to an issue. Look up the stage that owns that label.
// If the stage is auto, enqueue it.
const routeIssueLabeled = (event: PipelineEvent): Invocation[] => {
  if (!event.label || !event.issueId) return []
  const stage = getStageByLabel(event.label)
  if (!stage || stage.mode === 'manual') return []
  return [{ role: stage.role, stage: stage.id, issueId: event.issueId }]
}

// A human commented on an issue. Resume whichever agent is active on it
// (identified by the current agent: label) and inject the comment.
const routeCommentCreated = async (
  event: PipelineEvent,
  tracker: IssueTracker,
): Promise<Invocation[]> => {
  if (event.commentAuthorType !== 'human' || !event.commentBody || !event.issueId) {
    return []
  }

  const issue = await tracker.getIssue(event.issueId)
  const agentLabel = issue.labels.find(l => l.startsWith('agent:'))
  if (!agentLabel) return []

  const stage = getStageByLabel(agentLabel)
  if (!stage || stage.mode === 'manual') return []

  return [{
    role: stage.role,
    stage: stage.id,
    issueId: event.issueId,
    humanComment: event.commentBody,
  }]
}

// An issue was closed. PM checks for dependent tasks that can be unblocked
// or parent issues that can now be closed.
const routeIssueClosed = (event: PipelineEvent): Invocation[] => {
  if (!event.issueId) return []
  return [{
    role: 'pm',
    stage: 'monitor',
    humanComment:
      `Issue #${event.issueId} was just closed. ` +
      `Check for any dependent tasks that can now be unblocked, ` +
      `and close any parent features or epics whose children are all done.`,
  }]
}

// CI finished on a PR. Success → enqueue reviewer. Failure → re-enqueue developer.
const routeCiCompleted = async (
  event: PipelineEvent,
  tracker: IssueTracker,
): Promise<Invocation[]> => {
  if (!event.prId) return []

  const pr = await tracker.getPr(event.prId)
  if (!pr.linkedIssueId) return []

  if (event.ciConclusion === 'success') {
    return [{
      role: 'reviewer',
      stage: 'code_review',
      issueId: pr.linkedIssueId,
      prId: event.prId,
    }]
  }

  if (event.ciConclusion === 'failure') {
    return [{
      role: 'developer',
      stage: 'development',
      issueId: pr.linkedIssueId,
      prId: event.prId,
      humanComment: `CI failed on PR #${event.prId}. Fix the failing checks before re-opening the PR.`,
    }]
  }

  return []
}

// A PR was merged. PM closes the linked issue and checks for parent cascade.
const routePrMerged = async (
  event: PipelineEvent,
  tracker: IssueTracker,
): Promise<Invocation[]> => {
  if (!event.prId) return []

  const pr = await tracker.getPr(event.prId)
  if (!pr.linkedIssueId) return []

  return [{
    role: 'pm',
    stage: 'monitor',
    humanComment:
      `PR #${event.prId} was merged. ` +
      `Close issue #${pr.linkedIssueId}, then check if any parent features or epics ` +
      `should also be closed now that all their tasks are complete.`,
  }]
}
