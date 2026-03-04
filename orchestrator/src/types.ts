export type AgentName =
  | 'pm'
  | 'architect'
  | 'requirements'
  | 'developer'
  | 'tester'
  | 'reviewer'

export type ArchitectMode = 'epic_breakdown' | 'task_review' | 'pr_review'
export type TesterMode = 'pre_dev' | 'post_dev'
export type PmMode = 'init' | 'monitor'

export interface InvocationParams {
  agent: AgentName
  issueNumber?: number
  prNumber?: number
  architectMode?: ArchitectMode
  testerMode?: TesterMode
  pmMode?: PmMode
}

export interface ToolResult {
  tool_use_id: string
  output: string
  is_error?: boolean
}
