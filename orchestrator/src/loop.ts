import Anthropic from '@anthropic-ai/sdk'
import { anthropic } from './config.js'
import { getAgentConfig } from './agents.js'
import { buildContext } from './context.js'
import { getToolSchemas, executeTool } from './tools/index.js'
import { saveSession, loadSession, clearSession } from './session.js'
import { needsCompaction, compactMessages } from './compaction.js'
import { postComment } from './tools/github.js'
import type { InvocationParams } from './types.js'

const MAX_ITERATIONS = 50

// Validate and repair a loaded session's message sequence.
// The old index-parity compaction bug could produce a session where a user
// message containing tool_results appears without the preceding assistant
// tool_use message (because the cut point landed between them). This causes
// a 400 BadRequestError from the API.
//
// Strategy: walk the message array and collect every tool_use id that each
// assistant message declares. When we reach a user message, any tool_result
// blocks whose tool_use_id is NOT in the immediately preceding assistant's
// tool_use set are orphaned — strip the entire user message (it's safer than
// partially reconstructing it).
const repairMessages = (messages: Anthropic.MessageParam[], agent: string): Anthropic.MessageParam[] => {
  const repaired: Anthropic.MessageParam[] = []
  let prevAssistantToolIds = new Set<string>()

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      const ids = Array.isArray(msg.content)
        ? msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use').map(b => b.id)
        : []
      prevAssistantToolIds = new Set(ids)
      repaired.push(msg)
    } else {
      // user message — check for orphaned tool_results
      const content = msg.content
      if (Array.isArray(content) && content.some(b => typeof b === 'object' && 'type' in b && b.type === 'tool_result')) {
        const orphaned = content.filter(
          b => typeof b === 'object' && 'type' in b && b.type === 'tool_result' &&
               !prevAssistantToolIds.has((b as Anthropic.ToolResultBlockParam).tool_use_id),
        )
        if (orphaned.length > 0) {
          console.warn(`[${agent}] Dropping orphaned tool_result message (${orphaned.length} orphan(s)) — session was corrupted by old compaction bug`)
          prevAssistantToolIds = new Set()
          continue // skip this message entirely
        }
        prevAssistantToolIds = new Set()
      }
      repaired.push(msg)
    }
  }

  return repaired
}

// Retry backoff sequence in ms: 10s → 1min → 10min → 1h → 4h → (cycle)
const BACKOFF_MS = [10_000, 60_000, 600_000, 3_600_000, 14_400_000]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isOverloaded = (err: unknown): boolean => {
  if (!(err instanceof Anthropic.APIError)) return false
  const body = err.error as { error?: { type?: string } } | undefined
  return err.status === 529 || body?.error?.type === 'overloaded_error'
}

const formatDelay = (ms: number): string => {
  if (ms >= 3_600_000) return `${ms / 3_600_000}h`
  if (ms >= 60_000) return `${ms / 60_000}min`
  return `${ms / 1_000}s`
}

export const runAgent = async (params: InvocationParams): Promise<void> => {
  const { agent } = params
  const config = getAgentConfig(agent)
  const tools = getToolSchemas(agent)

  // Resume from saved session if one exists, otherwise start fresh
  const existing = loadSession(params)
  let messages: Anthropic.MessageParam[]
  let backoffIndex: number

  if (existing) {
    console.log(`[${agent}] Resuming session from ${existing.updatedAt}`)
    messages = repairMessages(existing.messages, agent)
    backoffIndex = existing.backoffIndex

    // If the session was saved right after an assistant tool_use response but
    // before tool_results were processed (process crash mid-iteration), inject
    // synthetic error results so the conversation stays valid.
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
      const unresolvedToolUses = lastMsg.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      if (unresolvedToolUses.length > 0) {
        console.warn(`[${agent}] Session ended mid tool_use — injecting synthetic error results`)
        messages.push({
          role: 'user',
          content: unresolvedToolUses.map(block => ({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: 'Error: session was interrupted before this tool result was received. Please retry.',
            is_error: true,
          })),
        })
      }
    }

    if (params.humanComment) {
      messages.push({ role: 'user', content: `[Human comment on issue]: ${params.humanComment}` })
      console.log(`[${agent}] Injecting human comment into session`)
    }
  } else {
    const context = await buildContext(params)
    messages = [{ role: 'user', content: context }]
    backoffIndex = 0
    console.log(`[${agent}] Starting — ${new Date().toISOString()}`)
  }

  let iterations = 0

  while (iterations < MAX_ITERATIONS) {
    iterations++

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create({
        model: config.model,
        max_tokens: 16384,
        system: config.systemPrompt,
        tools,
        messages,
      })
      // Successful call — reset backoff and persist session
      backoffIndex = 0
      saveSession(params, messages, backoffIndex)
    } catch (err) {
      if (isOverloaded(err)) {
        const delay = BACKOFF_MS[backoffIndex % BACKOFF_MS.length]
        backoffIndex = (backoffIndex + 1) % BACKOFF_MS.length
        // Persist so a restart can resume with the same backoff state
        saveSession(params, messages, backoffIndex)
        console.warn(`[${agent}] API overloaded. Retrying in ${formatDelay(delay)}...`)
        await sleep(delay)
        iterations--
        continue
      }
      throw err
    }

    console.log(`[${agent}] Iteration ${iterations} — stop_reason: ${response.stop_reason}`)

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      console.log(`[${agent}] Done`)
      clearSession(params)
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`[${agent}] Tool: ${block.name}`, block.input)
          try {
            const output = await executeTool(block.name, block.input as Record<string, unknown>)
            return { type: 'tool_result' as const, tool_use_id: block.id, content: output }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`[${agent}] Tool error (${block.name}): ${message}`)
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: `Error: ${message}`,
              is_error: true,
            }
          }
        }),
      )

      messages.push({ role: 'user', content: toolResults })

      if (needsCompaction(messages)) {
        console.log(`[${agent}] Compacting session history...`)
        messages = await compactMessages(params, messages)
        saveSession(params, messages, backoffIndex)
        console.log(`[${agent}] Session compacted`)
      }
      continue
    }

    console.warn(`[${agent}] Unexpected stop_reason: ${response.stop_reason}`)
    break
  }

  if (iterations >= MAX_ITERATIONS) {
    // Save with all messages including last assistant response + tool results
    saveSession(params, messages, backoffIndex)
    console.warn(`[${agent}] Hit max iterations (${MAX_ITERATIONS}) — session saved, awaiting "continue"`)

    const issueRef = params.issueNumber ?? params.prNumber
    if (issueRef) {
      postComment(
        issueRef,
        `[${agent.toUpperCase()}] Reached the iteration limit (${MAX_ITERATIONS}). Work is saved. Reply with "continue" to resume.`,
      ).catch(err => console.error(`[${agent}] Failed to post pause comment:`, err))
    }
  }
}
