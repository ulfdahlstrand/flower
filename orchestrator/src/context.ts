import { readFile } from './tools/files.js'
import { getIssue, listIssues, getPr, getPrDiff } from './tools/github.js'
import type { InvocationParams } from './types.js'

export const buildContext = async (params: InvocationParams): Promise<string> => {
  const { agent, issueNumber, prNumber, architectMode, testerMode, pmMode, requirementsMode } = params

  switch (agent) {
    case 'pm':
      return pmMode === 'init' ? buildPmInit() : buildPmMonitor()

    case 'architect':
      if (architectMode === 'epic_breakdown') return buildArchitectEpicBreakdown(issueNumber!)
      if (architectMode === 'task_review') return buildArchitectTaskReview(issueNumber!)
      if (architectMode === 'pr_review') return buildArchitectPrReview(prNumber!, issueNumber!)
      throw new Error('Architect requires architectMode')

    case 'requirements':
      if (requirementsMode === 'task_revision') return buildRequirementsTaskRevision(issueNumber!)
      return buildRequirements(issueNumber!)

    case 'developer':
      return buildDeveloper(issueNumber!)

    case 'tester':
      if (testerMode === 'pre_dev') return buildTesterPreDev(issueNumber!)
      if (testerMode === 'post_dev') return buildTesterPostDev(issueNumber!, prNumber!)
      throw new Error('Tester requires testerMode')

    case 'reviewer':
      return buildReviewer(prNumber!, issueNumber!)

    default:
      throw new Error(`Unknown agent: ${agent}`)
  }
}

const buildPmInit = (): string => {
  const brief = safeReadFile('product/brief.md')
  return `You are being invoked to initialize a new project.

## Product Brief
${brief}

## Current State
No milestones or issues exist yet.`
}


const buildPmMonitor = async (): Promise<string> => {
  const [all, blocked] = await Promise.all([
    listIssues([], undefined, 'open'),
    listIssues(['status:blocked'], undefined, 'open'),
  ])
  return `You are being invoked to monitor project progress and resolve blockers.

## Open Issues
${all}

## Blocked Issues
${blocked}`
}

const buildArchitectEpicBreakdown = async (epicNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const decisions = safeReadFile('docs/tech-decisions.md')
  const epic = await getIssue(epicNumber)
  return `You are being invoked to break down Epic #${epicNumber} into Feature issues.

## Epic #${epicNumber}
${epic}

## Current Architecture
${architecture}

## Tech Decisions
${decisions}`
}

const buildArchitectTaskReview = async (taskNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const taskState = safeReadFile(`tasks/${taskNumber}.json`)
  const task = await getIssue(taskNumber)
  const featureRef = extractParentRef(JSON.parse(task).body)
  const feature = featureRef ? await getIssue(featureRef) : '(no parent feature linked)'
  return `You are being invoked to review Task #${taskNumber} for architectural fit.

## Task #${taskNumber}
${task}

## Parent Feature
${feature}

## Current Architecture
${architecture}

## Task State
${taskState}`
}

const buildArchitectPrReview = async (prNumber: number, taskNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const [diff, task] = await Promise.all([getPrDiff(prNumber), getIssue(taskNumber)])
  return `You are being invoked to review PR #${prNumber} for architectural consistency.

## PR #${prNumber} Diff
${diff}

## Referenced Task #${taskNumber}
${task}

## Current Architecture
${architecture}`
}

const buildRequirements = async (featureNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const feature = await getIssue(featureNumber)
  const epicRef = extractParentRef(JSON.parse(feature).body)
  const epic = epicRef ? await getIssue(epicRef) : '(no parent epic linked)'
  return `You are being invoked to define Task issues for Feature #${featureNumber}.

## Feature #${featureNumber}
${feature}

## Parent Epic
${epic}

## Current Architecture
${architecture}`
}

const buildDeveloper = async (taskNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const taskState = safeReadFile(`tasks/${taskNumber}.json`)
  const taskRaw = await getIssue(taskNumber)
  const { comments: _comments, ...task } = JSON.parse(taskRaw)
  return `You are being invoked to implement Task #${taskNumber}.

## Task #${taskNumber}
${JSON.stringify(task, null, 2)}

## Task State
${taskState}

## Current Architecture
${architecture}`
}

const buildRequirementsTaskRevision = async (taskNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const taskState = safeReadFile(`tasks/${taskNumber}.json`)
  const task = await getIssue(taskNumber)
  return `You are being invoked to revise the acceptance criteria for Task #${taskNumber}.

The Tester or a human has flagged that the current acceptance criteria need updating.
Read the issue comments carefully to understand what needs to change, then revise
the task body and restart the Architect + Tester sign-off process.

## Task #${taskNumber}
${task}

## Task State
${taskState}

## Current Architecture
${architecture}`
}

const buildTesterPreDev = async (taskNumber: number): Promise<string> => {
  const taskState = safeReadFile(`tasks/${taskNumber}.json`)
  const task = await getIssue(taskNumber)
  return `You are being invoked to review Task #${taskNumber} for testability.

## Task #${taskNumber}
${task}

## Task State
${taskState}`
}

const buildTesterPostDev = async (taskNumber: number, prNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const taskState = safeReadFile(`tasks/${taskNumber}.json`)
  const [task, prRaw, diff] = await Promise.all([getIssue(taskNumber), getPr(prNumber), getPrDiff(prNumber)])
  const pr = JSON.parse(prRaw) as { head_branch: string }
  return `You are being invoked to test the implementation of Task #${taskNumber}.

## Feature Branch
The implementation is on branch: \`${pr.head_branch}\`
Call git_checkout_branch with this branch name before writing or running any tests.

## Task #${taskNumber} — Acceptance Criteria
${task}

## PR #${prNumber} Diff
${diff}

## Task State
${taskState}

## Test Conventions (from architecture.md)
${architecture}`
}

const buildReviewer = async (prNumber: number, taskNumber: number): Promise<string> => {
  const architecture = safeReadFile('docs/architecture.md')
  const taskState = safeReadFile(`tasks/${taskNumber}.json`)
  const [diff, task] = await Promise.all([getPrDiff(prNumber), getIssue(taskNumber)])
  return `You are being invoked to review PR #${prNumber}.

## PR #${prNumber} Diff
${diff}

## Referenced Task #${taskNumber}
${task}

## Current Architecture
${architecture}

## Task State
${taskState}`
}

const safeReadFile = (filePath: string): string => {
  try {
    return readFile(filePath)
  } catch {
    return '(file not found)'
  }
}

const extractParentRef = (body: string | null): number | null => {
  if (!body) return null
  const match = body.match(/Part of #(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}
