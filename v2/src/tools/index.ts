import type { IssueTracker } from '../types/index.js'

// ---------------------------------------------------------------------------
// Tool system
//
// Tools are pure data + a handler. Agents declare which tool names they need.
// The runner assembles the Claude-compatible tool list from the registry.
// Nothing is hardcoded per-agent in the runner.
// ---------------------------------------------------------------------------

export interface ToolContext {
  tracker: IssueTracker
  repoPath: string
}

export interface Tool<TInput = Record<string, unknown>> {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute(input: TInput, ctx: ToolContext): Promise<string>
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<string, Tool>()

export const registerTool = (tool: Tool): void => {
  registry.set(tool.name, tool)
}

export const getTool = (name: string): Tool | undefined => registry.get(name)

export const getToolsForAgent = (names: string[]): Tool[] =>
  names.map(n => registry.get(n)).filter((t): t is Tool => t !== undefined)

// Format tools for the Claude API
export const toClaudeTools = (tools: Tool[]) =>
  tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
