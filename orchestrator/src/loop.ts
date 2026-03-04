import type Anthropic from '@anthropic-ai/sdk'
import { anthropic } from './config.js'
import { getAgentConfig } from './agents.js'
import { buildContext } from './context.js'
import { getToolSchemas, executeTool } from './tools/index.js'
import type { InvocationParams } from './types.js'

const MAX_ITERATIONS = 50

export const runAgent = async (params: InvocationParams): Promise<void> => {
  const { agent } = params
  const config = getAgentConfig(agent)
  const context = await buildContext(params)
  const tools = getToolSchemas(agent)

  console.log(`[${agent}] Starting — ${new Date().toISOString()}`)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: context }]
  let iterations = 0

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: config.systemPrompt,
      tools,
      messages,
    })

    console.log(`[${agent}] Iteration ${iterations} — stop_reason: ${response.stop_reason}`)

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      console.log(`[${agent}] Done`)
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
      continue
    }

    console.warn(`[${agent}] Unexpected stop_reason: ${response.stop_reason}`)
    break
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error(`[${agent}] Hit max iterations (${MAX_ITERATIONS}) — stopping`)
  }
}
