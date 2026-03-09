import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentName } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface AgentConfig {
  model: string
  systemPrompt: string
}

const MODELS: Record<AgentName, string> = {
  pm: 'claude-sonnet-4-6',
  po: 'claude-sonnet-4-6',
  architect: 'claude-opus-4-6',
  requirements: 'claude-sonnet-4-6',
  developer: 'claude-sonnet-4-6',
  tester: 'claude-sonnet-4-6',
  reviewer: 'claude-opus-4-6',
}

const loadSystemPrompt = (agentName: AgentName): string =>
  fs.readFileSync(path.resolve(__dirname, `../../docs/agents/${agentName}.md`), 'utf-8')

export const getAgentConfig = (agentName: AgentName): AgentConfig => ({
  model: MODELS[agentName],
  systemPrompt: loadSystemPrompt(agentName),
})
