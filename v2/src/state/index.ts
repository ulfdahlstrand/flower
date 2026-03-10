// ---------------------------------------------------------------------------
// Pipeline state — read-only snapshot of what is currently happening.
//
// Reads directly from the SQLite queue and task state files.
// Intended for observability endpoints and CLI status commands.
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'
import type { TaskState } from '../types/index.js'
import type { QueueRow } from '../queue/index.js'
import type { Queue } from '../queue/index.js'

export interface PipelineState {
  running: QueueRow | null
  pending: QueueRow[]
  tasks: TaskState[]
}

export const getState = (queue: Queue, taskStateDir: string): PipelineState => {
  const running = queue.getRunning()
  const pending = queue.getPending()

  const tasks: TaskState[] = []

  if (fs.existsSync(taskStateDir)) {
    for (const file of fs.readdirSync(taskStateDir)) {
      if (!file.endsWith('.json')) continue
      try {
        const raw = fs.readFileSync(path.join(taskStateDir, file), 'utf8')
        tasks.push(JSON.parse(raw) as TaskState)
      } catch {
        // Ignore malformed files — they may be in the middle of being written
      }
    }
  }

  return { running, pending, tasks }
}

// Convenience: print a compact summary to stdout
export const printState = (state: PipelineState): void => {
  const now = new Date().toISOString()
  console.log(`\n─── Pipeline state (${now}) ─────────────────────`)

  if (state.running) {
    const r = state.running
    console.log(`  RUNNING  ${r.role}/${r.stage}  issue=${r.issueId ?? '-'}  since=${r.startedAt}`)
  } else {
    console.log('  RUNNING  (none)')
  }

  if (state.pending.length === 0) {
    console.log('  PENDING  (empty)')
  } else {
    for (const p of state.pending) {
      console.log(`  PENDING  ${p.role}/${p.stage}  issue=${p.issueId ?? '-'}`)
    }
  }

  if (state.tasks.length > 0) {
    console.log('')
    for (const t of state.tasks) {
      console.log(`  TASK #${t.issueId}  stage=${t.stage}  branch=${t.branch ?? '(none)'}`)
    }
  }

  console.log('───────────────────────────────────────────────\n')
}
