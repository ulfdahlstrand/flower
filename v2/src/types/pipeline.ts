// ---------------------------------------------------------------------------
// Pipeline definition
//
// A pipeline is a sequence of stages. Each stage is owned by a role.
// The router doesn't need a routing table — it looks up the current stage
// and dispatches to whoever owns it. Adding a new stage only requires
// adding a stage definition here, nowhere else.
// ---------------------------------------------------------------------------

export type AgentRole =
  | 'po'
  | 'pm'
  | 'requirements'
  | 'architect'
  | 'developer'
  | 'tester'
  | 'reviewer'

export type IssueType = 'feature-request' | 'epic' | 'feature' | 'task'

// A stage transition defines what happens when a stage ends.
export interface StageTransitions {
  // The stage to move to on successful completion.
  success: string
  // The stage to move to when the current role blocks on a dependency.
  // Defaults to staying in the same stage (blocked, waiting for a human or PM).
  blocked?: string
  // The stage to move to when the output is rejected by the next stage's owner.
  rejected?: string
}

export interface PipelineStage {
  // Unique identifier used in TaskState and routing.
  id: string
  // Human-readable name shown in comments and observability.
  name: string
  // Which role owns this stage. 'auto' uses the AI agent; 'manual' waits for a human.
  role: AgentRole
  mode: 'auto' | 'manual'
  // Which issue types this stage applies to.
  issueTypes: IssueType[]
  // The label that signals this stage is active on an issue.
  label: string
  // Where to go when this stage ends.
  transitions: StageTransitions
}

// The full pipeline is just an ordered list of stages.
// Ordering is informational — actual flow is driven by transitions.
export interface PipelineDefinition {
  stages: PipelineStage[]
}

// ---------------------------------------------------------------------------
// Events that flow through the pipeline
// ---------------------------------------------------------------------------

// A tracker-agnostic event that the webhook adapter translates into.
// The router acts on these — it never imports tracker SDKs directly.
export type PipelineEventType =
  | 'issue_opened'
  | 'issue_labeled'
  | 'issue_closed'
  | 'comment_created'
  | 'pr_merged'
  | 'ci_completed'

export interface PipelineEvent {
  type: PipelineEventType
  issueId?: number
  prId?: number
  label?: string            // for issue_labeled
  commentBody?: string      // for comment_created
  commentAuthorType?: 'human' | 'bot'
  ciConclusion?: 'success' | 'failure' | 'cancelled'  // for ci_completed
}
