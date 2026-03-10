import type { PipelineDefinition, PipelineStage } from '../types/index.js'

// ---------------------------------------------------------------------------
// The Flower pipeline definition.
//
// This is the single source of truth for how work flows through the system.
// The router reads this at runtime — it never hardcodes stage logic.
//
// To add a new stage: add an entry here. Nothing else changes.
// To make a stage manual: set mode: 'manual'. Nothing else changes.
// ---------------------------------------------------------------------------

const stages: PipelineStage[] = [
  // ------------------------------------------------------------------
  // Feature requests — conversational intake before anything is planned
  // ------------------------------------------------------------------
  {
    id: 'feature_intake',
    name: 'Feature intake',
    role: 'po',
    mode: 'auto',
    issueTypes: ['feature-request'],
    label: 'agent:po',
    transitions: {
      success: 'epic_planning',  // PO creates an epic/feature/task and closes the request
    },
  },

  // ------------------------------------------------------------------
  // Strategic tier — planning
  // ------------------------------------------------------------------
  {
    id: 'epic_planning',
    name: 'Epic planning',
    role: 'pm',
    mode: 'auto',
    issueTypes: ['epic'],
    label: 'agent:pm',
    transitions: {
      success: 'epic_breakdown',
    },
  },
  {
    id: 'epic_breakdown',
    name: 'Epic breakdown',
    role: 'requirements',
    mode: 'auto',
    issueTypes: ['epic'],
    label: 'agent:requirements',
    transitions: {
      success: 'feature_review',
    },
  },
  {
    id: 'feature_review',
    name: 'Feature review',
    role: 'architect',
    mode: 'auto',
    issueTypes: ['feature'],
    label: 'agent:architect',
    transitions: {
      success: 'task_definition',
      rejected: 'epic_breakdown',  // architect flags a gap → back to requirements
    },
  },

  // ------------------------------------------------------------------
  // Execution tier — per task
  // ------------------------------------------------------------------
  {
    id: 'task_definition',
    name: 'Task definition',
    role: 'requirements',
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:requirements',
    transitions: {
      success: 'task_architecture_review',
    },
  },
  {
    id: 'task_architecture_review',
    name: 'Architecture review',
    role: 'architect',
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:architect',
    transitions: {
      success: 'testability_review',
      rejected: 'task_definition',   // architect blocks → back to requirements
      blocked: 'architectural_task', // architect needs a dedicated decision first
    },
  },
  {
    id: 'architectural_task',
    name: 'Architectural decision',
    role: 'architect',
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:architect',
    transitions: {
      success: 'task_definition',  // decision made → requirements resumes
    },
  },
  {
    id: 'testability_review',
    name: 'Testability review',
    role: 'tester',
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:tester',
    transitions: {
      success: 'development',
      rejected: 'task_definition',  // criteria too vague → back to requirements
    },
  },
  {
    id: 'development',
    name: 'Development',
    role: 'developer',
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:developer',
    transitions: {
      success: 'ci',
      blocked: 'task_architecture_review',  // missing arch decision → architect
    },
  },
  {
    id: 'ci',
    name: 'CI',
    // CI is not an agent role — it is external. The orchestrator waits for
    // a ci_completed event and transitions automatically.
    role: 'developer',  // label stays on developer while CI runs
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:developer',
    transitions: {
      success: 'code_review',
    },
  },
  {
    id: 'code_review',
    name: 'Code review',
    role: 'reviewer',
    mode: 'auto',
    issueTypes: ['task'],
    label: 'agent:reviewer',
    transitions: {
      success: 'done',
      rejected: 'development',  // reviewer requests changes → back to developer
    },
  },
  {
    id: 'done',
    name: 'Done',
    role: 'pm',
    mode: 'auto',
    issueTypes: ['task', 'feature', 'epic'],
    label: 'status:done',
    transitions: {
      success: 'done',  // terminal — PM closes parent issues as needed
    },
  },
]

export const pipeline: PipelineDefinition = { stages }

// ---------------------------------------------------------------------------
// Lookup helpers used by the router
// ---------------------------------------------------------------------------

export const getStage = (id: string): PipelineStage | undefined =>
  stages.find(s => s.id === id)

export const getStageByLabel = (label: string): PipelineStage | undefined =>
  stages.find(s => s.label === label)

export const getStagesByRole = (role: string): PipelineStage[] =>
  stages.filter(s => s.role === role)
