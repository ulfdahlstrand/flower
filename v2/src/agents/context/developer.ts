import type { ContextBuilder } from '../../types/index.js'

export const buildDeveloperContext: ContextBuilder = async ({ issueId, tracker, taskState }) => {
  const issue = await tracker.getIssue(issueId!)

  const branchNote = taskState?.branch
    ? `⚠ An existing branch was recorded for this task: "${taskState.branch}". Call git_checkout_branch with this name — do NOT create a new branch.`
    : 'No branch recorded yet. Call git_create_branch with pattern task/{issue-id}-short-description, then immediately write the branch name to tasks/${issueId}.json.'

  return `You are the Developer implementing Task #${issueId}.

## Branch
${branchNote}

## Task #${issueId}
${JSON.stringify(issue, null, 2)}

## Task State
${taskState ? JSON.stringify(taskState, null, 2) : '(none)'}

Follow your workflow:
1. Check all dependencies are merged before writing any code.
2. Create or resume your branch (see Branch section above).
3. Implement only what the acceptance criteria require.
4. Before opening a PR: verify every criterion is satisfied and run_tests passes.
5. If blocked: commit any WIP with "wip: partial — blocked on <reason>", then post your blocker comment.`
}
