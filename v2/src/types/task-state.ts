// ---------------------------------------------------------------------------
// Task state — the machine-readable record for a single task issue.
// Stored as tasks/{issueId}.json in the target repository.
// ---------------------------------------------------------------------------

export type TaskStatus =
  | 'in_requirements'
  | 'ready_for_development'
  | 'in_progress'
  | 'in_review'
  | 'complete'
  | 'blocked'

export interface ConversationEntry {
  agent: string
  timestamp: string   // ISO 8601
  action: string
  summary: string
}

export interface TaskDecisions {
  approach: string | null
  filesToTouch: string[]
  risks: string[]
}

export interface TaskState {
  issueId: number
  // Current pipeline stage id — single source of truth for where this task is.
  stage: string
  status: TaskStatus
  // Branch name written as soon as the developer creates it.
  // On re-invocation the developer checks out this branch instead of creating a new one.
  branch: string | null
  conversationLog: ConversationEntry[]
  decisions: TaskDecisions
}

// The initial state written by Requirements when a task is first created.
export const initialTaskState = (issueId: number): TaskState => ({
  issueId,
  stage: 'task_definition',
  status: 'in_requirements',
  branch: null,
  conversationLog: [],
  decisions: {
    approach: null,
    filesToTouch: [],
    risks: [],
  },
})
