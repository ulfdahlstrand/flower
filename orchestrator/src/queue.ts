import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runAgent } from './loop.js'
import { REPO_PATH, MANUAL_AGENTS } from './config.js'
import { postComment } from './tools/github.js'
import type { InvocationParams } from './types.js'

const QUEUE_DIR = path.join(REPO_PATH, '.flower', 'queue')
const QUEUE_FILE = path.join(QUEUE_DIR, 'pending.json')
const LOCK_FILE = path.join(QUEUE_DIR, 'worker.lock')

interface LockState {
  pid: number
  hostname: string
  startedAt: string
  currentTask: InvocationParams
}

const ensureDir = () => fs.mkdirSync(QUEUE_DIR, { recursive: true })

const readQueue = (): InvocationParams[] => {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8')) as InvocationParams[]
  } catch {
    return []
  }
}

const writeQueue = (queue: InvocationParams[]): void => {
  ensureDir()
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8')
}

// Atomic lock acquisition using O_EXCL — fails if file already exists
const acquireLock = (params: InvocationParams): boolean => {
  ensureDir()
  try {
    const state: LockState = {
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
      currentTask: params,
    }
    fs.writeFileSync(LOCK_FILE, JSON.stringify(state, null, 2), { flag: 'wx' })
    return true
  } catch {
    return false
  }
}

const releaseLock = (): void => {
  try { fs.unlinkSync(LOCK_FILE) } catch { /* already gone */ }
}

// Returns the task from a stale lock so it can be re-queued
const checkStaleLock = (): InvocationParams | null => {
  try {
    const state = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as LockState
    try {
      process.kill(state.pid, 0) // signal 0 = existence check only
      return null // process is still running
    } catch {
      return state.currentTask // process is gone — lock is stale
    }
  } catch {
    return null // no lock file
  }
}

// In-process guard to prevent re-entrancy within the same process
let processing = false

const processQueue = async (): Promise<void> => {
  if (processing) return

  const stalledTask = checkStaleLock()
  if (stalledTask) {
    console.warn('[queue] Stale lock detected — re-queuing crashed task and clearing lock')
    const queue = readQueue()
    writeQueue([stalledTask, ...queue])
    releaseLock()
  }

  const queue = readQueue()
  if (queue.length === 0) return

  const params = queue[0]
  if (!acquireLock(params)) {
    console.log('[queue] Lock held by another worker — standing by')
    return
  }

  writeQueue(queue.slice(1))
  processing = true

  try {
    const remaining = readQueue().length
    console.log(`[queue] Running ${params.agent}${params.issueNumber ? ` #${params.issueNumber}` : ''}${params.prNumber ? ` PR#${params.prNumber}` : ''} (${remaining} queued)`)
    await runAgent(params)
  } finally {
    releaseLock()
    processing = false
    const queueAfter = readQueue()
    const queueDrained = queueAfter.length === 0
    // Wake PM when the pipeline drains so it can distribute new work.
    // Only trigger for non-PM agents (to avoid loops) or when PM setup just finished.
    const shouldWakePm =
      (params.agent !== 'pm' && queueDrained) ||
      (params.agent === 'pm' && params.pmMode === 'setup')
    if (shouldWakePm) {
      console.log(`[queue] Queue drained after ${params.agent} — scheduling PM to check for new work`)
      enqueueAgent({ agent: 'pm' })
    } else {
      setImmediate(processQueue)
    }
  }
}

// Read the blocking issue number from a task's conversation_log, if it's blocked.
// Returns the issue number mentioned in the last 'blocked' log entry, or null.
const getBlockingIssue = (issueNumber: number): number | null => {
  try {
    const taskPath = path.join(REPO_PATH, 'tasks', `${issueNumber}.json`)
    const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8')) as {
      conversation_log?: Array<{ action: string; summary?: string }>
    }
    const log = task.conversation_log ?? []
    const blocked = [...log].reverse().find(e => e.action === 'blocked')
    if (!blocked?.summary) return null
    const match = blocked.summary.match(/#(\d+)/)
    return match ? parseInt(match[1], 10) : null
  } catch {
    return null
  }
}

export const isAgentPendingForPr = (agent: string, prNumber: number): boolean => {
  const queue = readQueue()
  if (queue.some(p => p.agent === agent && p.prNumber === prNumber)) return true
  try {
    const state = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as LockState
    try {
      process.kill(state.pid, 0) // throws if process is gone
      return state.currentTask.agent === agent && state.currentTask.prNumber === prNumber
    } catch {
      return false // stale lock
    }
  } catch {
    return false // no lock file
  }
}

export const enqueueAgent = (params: InvocationParams): void => {
  if (MANUAL_AGENTS.has(params.agent)) {
    console.log(`[queue] ${params.agent} is configured as manual — skipping auto-invocation`)
    if (params.issueNumber) {
      postComment(
        params.issueNumber,
        `[ORCHESTRATOR] This step requires a human **${params.agent}**. When done, post \`@agent:<next-agent>\` to continue the pipeline.`,
      ).catch(err => console.error('[queue] Failed to post manual notice:', err))
    }
    processQueue().catch(err => console.error('[queue] processQueue error:', err))
    return
  }

  const queue = readQueue()
  const last = queue.at(-1)
  if (last) {
    // Compare without humanComment — it's dynamic and not meaningful for dedup
    const { humanComment: _a, ...incoming } = params
    const { humanComment: _b, ...lastParams } = last
    if (JSON.stringify(incoming) === JSON.stringify(lastParams)) {
      console.log(`[queue] Skipping duplicate ${params.agent}${params.issueNumber ? ` #${params.issueNumber}` : ''} entry`)
      processQueue().catch(err => console.error('[queue] processQueue error:', err))
      return
    }
  }
  // If this task is blocked on another issue that is already queued,
  // insert it after that issue's entry so the blocker runs first.
  let insertIndex = queue.length
  if (params.issueNumber) {
    const blockingIssue = getBlockingIssue(params.issueNumber)
    if (blockingIssue !== null) {
      // findLastIndex isn't in the current TS lib target — scan from the end manually
      let blockingIndex = -1
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].issueNumber === blockingIssue) { blockingIndex = i; break }
      }
      if (blockingIndex !== -1) {
        insertIndex = blockingIndex + 1
        console.log(`[queue] Task #${params.issueNumber} is blocked on #${blockingIssue} — inserting after it (position ${insertIndex})`)
      }
    }
  }

  queue.splice(insertIndex, 0, params)
  writeQueue(queue)
  console.log(`[queue] Enqueued ${params.agent} (depth: ${queue.length})`)
  processQueue().catch(err => console.error('[queue] processQueue error:', err))
}

// Call on startup to recover any tasks that were pending when the process last stopped
export const recoverQueue = (): void => {
  const stalledTask = checkStaleLock()
  if (stalledTask) {
    console.warn('[queue] Stale lock on startup — re-queuing crashed task')
    const queue = readQueue()
    writeQueue([stalledTask, ...queue])
    releaseLock()
  }
  const queue = readQueue()
  if (queue.length > 0) {
    console.log(`[queue] Resuming ${queue.length} pending task(s)`)
    processQueue().catch(err => console.error('[queue] recoverQueue error:', err))
  }
}
