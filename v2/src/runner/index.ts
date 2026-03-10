import Anthropic from '@anthropic-ai/sdk'
import type { AgentConfig, Invocation } from '../types/index.js'
import type { ToolContext } from '../tools/index.js'
import { getToolsForAgent, toClaudeTools, getTool } from '../tools/index.js'
import { loadSession, saveSession, clearSession, archiveSession } from './session.js'

// ---------------------------------------------------------------------------
// Claude agent runner
//
// Runs a single agent invocation to completion. The runner is generic —
// all agent-specific behaviour comes from AgentConfig and the tool registry.
// ---------------------------------------------------------------------------

export interface RunnerConfig {
  anthropic: Anthropic
  toolCtx: ToolContext
  sessionsDir: string
  // Token threshold at which we compact older messages using Haiku
  compactionThreshold?: number
}

const COMPACTION_THRESHOLD = 80_000  // tokens

export const runAgent = async (
  invocation: Invocation,
  agentConfig: AgentConfig,
  cfg: RunnerConfig,
): Promise<void> => {
  const { anthropic, toolCtx, sessionsDir } = cfg
  const threshold = cfg.compactionThreshold ?? COMPACTION_THRESHOLD
  const label = `[${agentConfig.role}]`

  console.log(`${label} Starting — ${new Date().toISOString()}`)

  // Build context (system prompt)
  const systemPrompt = await agentConfig.buildContext({
    issueId: invocation.issueId,
    prId: invocation.prId,
    stage: invocation.stage,
    tracker: toolCtx.tracker,
  })

  // Load or create session
  let session = loadSession(sessionsDir, invocation)
  if (!session) {
    session = {
      invocation,
      messages: [],
      iterationCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  // Inject human comment if resuming a paused session
  if (invocation.humanComment) {
    session.messages.push({ role: 'user', content: invocation.humanComment })
    console.log(`${label} Injecting human comment — ${new Date().toISOString()}`)
  }

  // If this is a fresh start (no messages), add the initial user prompt
  if (session.messages.length === 0) {
    session.messages.push({ role: 'user', content: 'Begin.' })
  }

  const tools = getToolsForAgent(agentConfig.tools)
  const claudeTools = toClaudeTools(tools)

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------
  while (true) {
    session.iterationCount++

    // Compact if approaching token limit
    if (session.iterationCount > 1) {
      session.messages = await maybeCompact(session.messages, threshold, anthropic, label)
    }

    const response = await anthropic.messages.create({
      model: agentConfig.model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: claudeTools,
      messages: session.messages,
    })

    console.log(`${label} Iteration ${session.iterationCount} — stop_reason: ${response.stop_reason}`)

    // Append assistant response to history
    session.messages.push({ role: 'assistant', content: response.content })
    saveSession(sessionsDir, session)

    if (response.stop_reason === 'end_turn') {
      console.log(`${label} Done`)
      archiveSession(sessionsDir, invocation)
      return
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        console.log(`${label} Tool: ${block.name} ${JSON.stringify(block.input)}`)

        const tool = getTool(block.name)
        if (!tool) {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Unknown tool: ${block.name}`, is_error: true })
          continue
        }

        try {
          const output = await tool.execute(block.input as Record<string, unknown>, toolCtx)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`${label} Tool error (${block.name}): ${msg}`)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${msg}`, is_error: true })
        }
      }

      session.messages.push({ role: 'user', content: toolResults })
      saveSession(sessionsDir, session)
      continue
    }

    // max_tokens or unexpected stop — save and exit
    console.warn(`${label} Unexpected stop_reason: ${response.stop_reason}`)
    return
  }
}

// ---------------------------------------------------------------------------
// Compaction — summarise early messages with Haiku when context grows large
// ---------------------------------------------------------------------------

const maybeCompact = async (
  messages: Anthropic.MessageParam[],
  threshold: number,
  anthropic: Anthropic,
  label: string,
): Promise<Anthropic.MessageParam[]> => {
  const approxTokens = JSON.stringify(messages).length / 4
  if (approxTokens < threshold || messages.length < 6) return messages

  // Keep the last 4 messages intact, summarise everything before
  const toSummarise = messages.slice(0, -4)
  const toKeep = messages.slice(-4)

  console.log(`${label} Compacting ${toSummarise.length} messages…`)

  const { content } = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Summarise the following agent conversation history concisely. Preserve all decisions made, files touched, issues created, and key facts. Discard verbose reasoning.\n\n${JSON.stringify(toSummarise)}`,
      },
    ],
  })

  const summary = content[0]?.type === 'text' ? content[0].text : '(summary unavailable)'
  console.log(`${label} Compacted to summary`)

  return [
    { role: 'user', content: `[Session context summary]\n${summary}` },
    { role: 'assistant', content: 'Understood. Continuing from the summary.' },
    ...toKeep,
  ]
}
