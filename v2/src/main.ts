// ---------------------------------------------------------------------------
// Entry point — reads config from env, creates the app, starts the server.
// ---------------------------------------------------------------------------

import { createApp } from './app.js'
import { createServer } from './server/index.js'

const required = (name: string): string => {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

const cfg = {
  githubToken: required('GITHUB_TOKEN'),
  githubOwner: required('GITHUB_OWNER'),
  githubRepo: required('GITHUB_REPO'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  dbPath: process.env.DB_PATH,
  sessionsDir: process.env.SESSIONS_DIR,
  taskStateDir: process.env.TASK_STATE_DIR,
  repoPath: process.env.REPO_PATH,
  compactionThreshold: process.env.COMPACTION_THRESHOLD
    ? parseInt(process.env.COMPACTION_THRESHOLD, 10)
    : undefined,
}

const app = createApp(cfg)

const server = createServer(app, {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  webhookSecret: process.env.WEBHOOK_SECRET,
})

// Graceful shutdown
const shutdown = () => {
  console.log('\n[main] Shutting down…')
  server.close(() => {
    app.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
