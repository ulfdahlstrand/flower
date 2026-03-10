import type { ContextBuilder } from '../../types/index.js'

export const buildPmContext: ContextBuilder = async ({ tracker, stage }) => {
  const isSetup = stage === 'setup'
  if (isSetup) {
    return `You are the PM Agent running the repository setup check.
Verify all required labels exist. Create any that are missing.
Verify all required issue templates exist. If any are missing, create a developer task to add them.
Do nothing else. When done, stop.`
  }

  const [allRaw, brief] = await Promise.all([
    tracker.listIssues({ state: 'open' }),
    Promise.resolve('(read from product/brief.md using read_file)'),
  ])

  const activeCount = allRaw.filter(i =>
    i.labels.some(l => l.startsWith('agent:') && l !== 'agent:pm'),
  ).length

  return `You are the PM Agent. You own the project pipeline at a strategic level.
Your scope: advance issues from status:backlog or status:blocked only.
Never touch PRs. Never re-trigger in-progress agents.

## Product Brief
${brief}

## Pipeline Capacity
Open issues with active agent labels: ${activeCount}
Recommended max concurrent: 3
${activeCount === 0 ? '⚠ Queue is empty — agent labels are stale if present. Proceed with advancing backlog.' : ''}

## Open Issues
${JSON.stringify(allRaw, null, 2)}`
}
