import Anthropic from '@anthropic-ai/sdk'
import { Octokit } from '@octokit/rest'

const requireEnv = (name: string): string => {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required environment variable: ${name}`)
  return val
}

export const anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })
export const octokit = new Octokit({ auth: requireEnv('GITHUB_TOKEN') })
export const OWNER = requireEnv('GITHUB_OWNER')
export const REPO = requireEnv('GITHUB_REPO')
export const REPO_PATH = process.env.REPO_PATH ?? process.cwd()
export const PORT = parseInt(process.env.PORT ?? '3000', 10)
export const WEBHOOK_SECRET = requireEnv('GITHUB_WEBHOOK_SECRET')
export const TEST_COMMAND = process.env.TEST_COMMAND ?? 'npm test'
