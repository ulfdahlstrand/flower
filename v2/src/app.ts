// ---------------------------------------------------------------------------
// App — composition root.
//
// Creates all long-lived singletons (queue, tracker, executor) and exposes
// a clean API surface:
//   handle(event)  — route a PipelineEvent and enqueue any resulting agents
//   state()        — read-only snapshot of the current pipeline state
//
// The webhook server (Phase 5) imports this and calls handle(). Tests can
// call handle() directly without an HTTP layer.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import type { PipelineEvent } from './types/index.js'
import { Queue } from './queue/index.js'
import { GitHubTracker } from './trackers/github.js'
import { route } from './router/index.js'
import { Executor } from './executor/index.js'
import { getState, type PipelineState } from './state/index.js'
import type { RunnerConfig } from './runner/index.js'

// Side-effect: register all tools into the registry
import './tools/github.js'
import './tools/files.js'
import './tools/git.js'
import './tools/shell.js'

export interface AppConfig {
  // GitHub / issue tracker
  githubToken: string
  githubOwner: string
  githubRepo: string
  // Anthropic
  anthropicApiKey: string
  // File system paths (all relative to cwd by default)
  dbPath?: string
  sessionsDir?: string
  taskStateDir?: string
  repoPath?: string
  // Runner tuning
  compactionThreshold?: number
}

export interface App {
  handle(event: PipelineEvent): Promise<void>
  state(): PipelineState
  queue: Queue
  executor: Executor
  close(): void
}

export const createApp = (cfg: AppConfig): App => {
  const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey })

  const tracker = new GitHubTracker(cfg.githubToken, cfg.githubOwner, cfg.githubRepo)

  const dbPath = cfg.dbPath ?? '.flower/queue.db'
  const sessionsDir = cfg.sessionsDir ?? '.flower/sessions'
  const taskStateDir = cfg.taskStateDir ?? 'tasks'
  const repoPath = cfg.repoPath ?? process.cwd()

  const queue = new Queue(dbPath)

  const runnerCfg: RunnerConfig = {
    anthropic,
    toolCtx: { tracker, repoPath },
    sessionsDir,
    taskStateDir,
    compactionThreshold: cfg.compactionThreshold,
  }

  const executor = new Executor(queue, runnerCfg)

  const handle = async (event: PipelineEvent): Promise<void> => {
    const invocations = await route(event, tracker)
    if (invocations.length > 0) {
      console.log(`[app] ${event.type} → ${invocations.length} invocation(s)`)
      executor.enqueueAndProcess(invocations)
    } else {
      console.log(`[app] ${event.type} → no invocations`)
    }
  }

  const state = (): PipelineState => getState(queue, taskStateDir)

  const close = (): void => queue.close()

  return { handle, state, queue, executor, close }
}
