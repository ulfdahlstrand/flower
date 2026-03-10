// ---------------------------------------------------------------------------
// GitHub webhook payload → PipelineEvent translator.
//
// This is the only place that knows the shape of raw GitHub webhook payloads.
// Everything upstream works with the tracker-agnostic PipelineEvent type.
// ---------------------------------------------------------------------------

import type { PipelineEvent } from '../types/index.js'

// Raw GitHub webhook event shapes (only the fields we need)
interface GitHubIssuePayload {
  action: string
  issue: { number: number; state?: string }
  label?: { name: string }
  comment?: { body: string; user?: { type?: string } }
  sender?: { type?: string }
}

interface GitHubPrPayload {
  action: string
  pull_request: {
    number: number
    body?: string
    merged?: boolean
    head?: { ref: string }
  }
}

interface GitHubCheckRunPayload {
  action: string
  check_run: {
    conclusion: string | null
    pull_requests: Array<{ number: number }>
  }
}

// Translate a raw GitHub webhook into a PipelineEvent.
// Returns null if the event is not relevant to the pipeline.
export const translateGitHubWebhook = (
  eventName: string,
  payload: unknown,
): PipelineEvent | null => {
  const p = payload as Record<string, unknown>

  switch (eventName) {
    case 'issues': {
      const ip = p as unknown as GitHubIssuePayload

      if (ip.action === 'labeled' && ip.label) {
        return {
          type: 'issue_labeled',
          issueId: ip.issue.number,
          label: ip.label.name,
        }
      }

      if (ip.action === 'closed') {
        return {
          type: 'issue_closed',
          issueId: ip.issue.number,
        }
      }

      return null
    }

    case 'issue_comment': {
      const cp = p as unknown as GitHubIssuePayload
      if (cp.action !== 'created' || !cp.comment) return null

      const authorType = cp.comment.user?.type === 'Bot' ? 'bot' : 'human'
      return {
        type: 'comment_created',
        issueId: cp.issue.number,
        commentBody: cp.comment.body,
        commentAuthorType: authorType,
      }
    }

    case 'pull_request': {
      const pp = p as unknown as GitHubPrPayload

      if (pp.action === 'closed' && pp.pull_request.merged) {
        return {
          type: 'pr_merged',
          prId: pp.pull_request.number,
        }
      }

      return null
    }

    case 'check_run': {
      const cp = p as unknown as GitHubCheckRunPayload
      if (cp.action !== 'completed') return null
      if (!cp.check_run.conclusion) return null

      const pr = cp.check_run.pull_requests[0]
      if (!pr) return null

      const conclusion = cp.check_run.conclusion
      return {
        type: 'ci_completed',
        prId: pr.number,
        ciConclusion:
          conclusion === 'success' ? 'success' :
          conclusion === 'cancelled' ? 'cancelled' :
          'failure',
      }
    }

    default:
      return null
  }
}
