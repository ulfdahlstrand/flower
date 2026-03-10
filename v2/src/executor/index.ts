// ---------------------------------------------------------------------------
// Executor — dequeues and runs agent invocations one at a time.
//
// Design choices:
// - Single-item concurrency: one agent runs at a time to prevent races
//   on the shared repository and issue tracker.
// - Auto-advance: after completing an item, immediately checks for more.
// - Crash-safe: on uncaught errors the item is reset to 'pending' so it
//   will be retried on the next processNext() call.
// ---------------------------------------------------------------------------

import type { AgentRole, Invocation } from '../types/index.js'
import type { RunnerConfig } from '../runner/index.js'
import { Queue } from '../queue/index.js'
import { runAgent } from '../runner/index.js'
import { agentConfigs } from '../agents/index.js'

export class Executor {
  private processing = false

  constructor(
    private readonly queue: Queue,
    private readonly runnerCfg: RunnerConfig,
  ) {}

  // Enqueue one or more invocations and start processing if idle.
  enqueueAndProcess(invocations: Invocation[]): void {
    for (const inv of invocations) {
      const result = this.queue.enqueue(inv)
      if (result.queued) {
        console.log(`[executor] Enqueued ${inv.role}/${inv.stage} for issue ${inv.issueId ?? '-'}`)
      } else {
        console.log(`[executor] Skipped duplicate ${inv.role}/${inv.stage}`)
      }
    }
    this.processNext().catch(err => console.error('[executor] processNext error:', err))
  }

  // Process the next pending queue item.
  // No-ops if something is already running.
  async processNext(): Promise<void> {
    if (this.processing) return

    const item = this.queue.dequeueNext()
    if (!item) return

    this.processing = true
    console.log(`[executor] Starting ${item.role}/${item.stage} (queue id=${item.id})`)

    try {
      const config = agentConfigs[item.role as AgentRole]
      if (!config) throw new Error(`No config registered for role: ${item.role}`)

      await runAgent(item.invocation, config, this.runnerCfg)
      this.queue.complete(item.id)
      console.log(`[executor] Completed ${item.role}/${item.stage}`)
    } catch (err) {
      console.error(`[executor] Failed ${item.role}/${item.stage}:`, err)
      this.queue.fail(item.id)
    } finally {
      this.processing = false
    }

    // Advance to the next item without growing the call stack
    setImmediate(() => this.processNext().catch(err =>
      console.error('[executor] processNext error:', err)
    ))
  }
}
