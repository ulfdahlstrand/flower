import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type Anthropic from '@anthropic-ai/sdk'
import type { InvocationParams } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSIONS_DIR = path.resolve(__dirname, '../../sessions')

interface Session {
  params: InvocationParams
  messages: Anthropic.MessageParam[]
  backoffIndex: number
  startedAt: string
  updatedAt: string
}

const sessionKey = (params: InvocationParams): string => {
  const { agent, issueNumber, prNumber, architectMode, testerMode, pmMode } = params
  const ref = issueNumber ?? prNumber ?? 'noref'
  const mode = architectMode ?? testerMode ?? pmMode ?? 'default'
  return `${agent}-${ref}-${mode}`
}

const sessionPath = (params: InvocationParams): string =>
  path.join(SESSIONS_DIR, `${sessionKey(params)}.json`)

export const saveSession = (params: InvocationParams, messages: Anthropic.MessageParam[], backoffIndex: number): void => {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const session: Session = {
    params,
    messages,
    backoffIndex,
    startedAt: loadSession(params)?.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(sessionPath(params), JSON.stringify(session, null, 2), 'utf-8')
}

export const loadSession = (params: InvocationParams): Session | null => {
  try {
    const raw = fs.readFileSync(sessionPath(params), 'utf-8')
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export const clearSession = (params: InvocationParams): void => {
  try {
    fs.unlinkSync(sessionPath(params))
  } catch {
    // already gone
  }
}
