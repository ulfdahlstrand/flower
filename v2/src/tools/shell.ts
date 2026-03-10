import { execSync } from 'node:child_process'
import { registerTool } from './index.js'

const TEST_COMMAND = process.env['TEST_COMMAND'] ?? 'npm test'

registerTool({
  name: 'run_tests',
  description: 'Run the project test suite. Returns stdout/stderr and exit code.',
  inputSchema: { type: 'object', properties: {} },
  async execute(_input, { repoPath }) {
    try {
      const output = execSync(TEST_COMMAND, { cwd: repoPath, encoding: 'utf-8', timeout: 120_000 })
      return `Tests passed.\n${output}`
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; status?: number }
      return `Tests failed (exit ${e.status ?? 1}).\n${e.stdout ?? ''}\n${e.stderr ?? ''}`
    }
  },
})

registerTool({
  name: 'run_command',
  description: 'Run a shell command in the repository root. Use for package installs and build steps only.',
  inputSchema: {
    type: 'object',
    properties: { command: { type: 'string' } },
    required: ['command'],
  },
  async execute({ command }: { command: string }, { repoPath }) {
    try {
      const output = execSync(command, { cwd: repoPath, encoding: 'utf-8', timeout: 60_000 })
      return output || '(no output)'
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; status?: number }
      return `Command failed (exit ${e.status ?? 1}).\n${e.stdout ?? ''}\n${e.stderr ?? ''}`
    }
  },
})
