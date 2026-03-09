export type AgentName =
  | 'pm'
  | 'po'
  | 'architect'
  | 'requirements'
  | 'developer'
  | 'tester'
  | 'reviewer'

export type ArchitectMode = 'feature_review' | 'task_review' | 'architectural_task' | 'pr_review'
export type TesterMode = 'pre_dev' | 'post_dev'
export type PmMode = 'setup' | 'init' | 'monitor'
export type RequirementsMode = 'epic_breakdown' | 'feature' | 'task_revision'
export type DeveloperMode = 'playbook'

export interface InvocationParams {
  agent: AgentName
  issueNumber?: number
  prNumber?: number
  architectMode?: ArchitectMode
  testerMode?: TesterMode
  pmMode?: PmMode
  requirementsMode?: RequirementsMode
  developerMode?: DeveloperMode
  humanComment?: string
}

export interface ToolResult {
  tool_use_id: string
  output: string
  is_error?: boolean
}
