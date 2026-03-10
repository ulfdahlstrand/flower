import type { ContextBuilder } from '../../types/index.js'

export const buildTesterContext: ContextBuilder = async ({ issueId, prId, stage, tracker, taskState }) => {
  const issue = await tracker.getIssue(issueId!)

  if (stage === 'testability_review') {
    return `You are the Tester reviewing Task #${issueId} for testability before development begins.
You are NOT reviewing code — none exists yet.

## Task #${issueId}
${JSON.stringify(issue, null, 2)}

## Task State
${taskState ? JSON.stringify(taskState, null, 2) : '(none)'}

For each acceptance criterion ask: is it binary? specific? within scope?
Reject criteria that are vague, subjective, or already enforced by CI (lint, build, type-check, "all tests pass").
Approve → post [TESTER] Approved. @agent:developer
Reject → post [TESTER] Needs revision. <explain each problem> @agent:requirements`
  }

  // post_dev — test execution on the PR branch
  const pr = prId ? await tracker.getPr(prId) : null
  const diff = prId ? await tracker.getPrDiff(prId) : '(no PR)'

  return `You are the Tester verifying the implementation of Task #${issueId} on PR #${prId}.

## Branch
${pr?.headBranch ?? '(unknown)'} — call git_checkout_branch before running tests.

## Task #${issueId} — Acceptance Criteria
${JSON.stringify(issue, null, 2)}

## PR Diff
${diff.slice(0, 30_000)}

## Task State
${taskState ? JSON.stringify(taskState, null, 2) : '(none)'}

Verify each acceptance criterion. Run run_tests. Report pass/fail per criterion.`
}
