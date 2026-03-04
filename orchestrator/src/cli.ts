/**
 * CLI entry point for manually invoking the PM agent.
 *
 * Usage:
 *   npm run pm:init     — Initialize a new project (reads product/brief.md)
 *   npm run pm:monitor  — Scan open issues and resolve blockers
 */
import { runAgent } from './loop.js'

const mode = process.argv[2]

if (mode !== 'init' && mode !== 'monitor') {
  console.error('Usage: cli.ts <init|monitor>')
  process.exit(1)
}

runAgent({ agent: 'pm', pmMode: mode }).catch(err => {
  console.error(err)
  process.exit(1)
})
