// ---------------------------------------------------------------------------
// Agent definition
//
// An agent is a config object + a context builder function.
// There is no agent-specific code in the orchestrator — agents are data.
// ---------------------------------------------------------------------------

import type { AgentRole } from './pipeline.js'
import type { IssueTracker } from './issue-tracker.js'
import type { TaskState } from './task-state.js'

// The runtime context passed to a context builder.
export interface ContextInput {
  issueId?: number
  prId?: number
  stage: string
  tracker: IssueTracker
  taskState?: TaskState
}

// A context builder is a pure async function: input → prompt string.
// No side effects. No direct GitHub/Jira calls inside — use tracker.
export type ContextBuilder = (input: ContextInput) => Promise<string>

export interface AgentConfig {
  role: AgentRole
  model: string
  // Tool names this agent has access to (looked up in the tool registry).
  tools: string[]
  // Builds the system prompt for this invocation.
  buildContext: ContextBuilder
}

// What the orchestrator sends to the agent runner for a single invocation.
export interface Invocation {
  role: AgentRole
  stage: string
  issueId?: number
  prId?: number
  // Injected when a human posts a comment that resumes a paused session.
  humanComment?: string
}
