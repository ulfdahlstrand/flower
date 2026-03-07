import Anthropic from '@anthropic-ai/sdk'
import { anthropic } from './config.js'
import { archiveSession } from './session.js'
import type { InvocationParams } from './types.js'

// Trigger compaction when the serialised message history exceeds this size
const COMPACTION_THRESHOLD = 60_000 // chars (~15k tokens)

// Number of recent messages to keep as raw history after compaction.
// Must be even so the kept block ends on a user (tool_results) message,
// meaning recent[0] is always an assistant message — required for a
// valid alternating user/assistant conversation after the compacted user message.
const KEEP_RECENT = 10

export const needsCompaction = (messages: Anthropic.MessageParam[]): boolean =>
  JSON.stringify(messages).length > COMPACTION_THRESHOLD

export const compactMessages = async (
  params: InvocationParams,
  messages: Anthropic.MessageParam[],
): Promise<Anthropic.MessageParam[]> => {
  // cutIdx is the first message of the "recent" block.
  // It must point to an assistant message so the conversation stays valid:
  // [augmentedInitial (user), assistant, user, ...].
  // We scan backward from the target cut point rather than relying on index
  // parity, which breaks when a humanComment user-message is injected (two
  // consecutive user messages shift all subsequent parities).
  let cutIdx = messages.length - KEEP_RECENT
  while (cutIdx > 1 && messages[cutIdx]?.role !== 'assistant') {
    cutIdx--
  }
  if (cutIdx <= 1) return messages // nothing meaningful to compact

  const toArchive = messages.slice(1, cutIdx) // skip messages[0] (initial context)
  const recent = messages.slice(cutIdx)

  const archiveFilename = archiveSession(params, toArchive)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          'Summarize this agent work log concisely. Include: files read/written,',
          'GitHub operations and their outcomes (issue numbers, PR numbers, branch names),',
          'key decisions made, and current task state.',
          'Skip tool call structure — just state what happened and what was accomplished.\n',
          JSON.stringify(toArchive).slice(0, 100_000),
        ].join(' '),
      },
    ],
  })

  const summary =
    response.content[0]?.type === 'text' ? response.content[0].text : '(summary unavailable)'

  const initialContent =
    typeof messages[0].content === 'string'
      ? messages[0].content
      : JSON.stringify(messages[0].content)

  const augmentedInitial: Anthropic.MessageParam = {
    role: 'user',
    content:
      `${initialContent}\n\n` +
      `--- [COMPACTED HISTORY — full log archived to ${archiveFilename}] ---\n` +
      `${summary}\n` +
      `--- [END COMPACTED HISTORY] ---`,
  }

  return [augmentedInitial, ...recent]
}
