import fs from 'node:fs'
import path from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import type { Invocation } from '../types/index.js'

// ---------------------------------------------------------------------------
// Session management
//
// A session is the conversation history for a single agent invocation.
// Sessions are persisted so agents can be paused (waiting for human input)
// and resumed without losing context.
// ---------------------------------------------------------------------------

export interface Session {
  invocation: Invocation
  messages: Anthropic.MessageParam[]
  iterationCount: number
  createdAt: string
  updatedAt: string
}

const sessionKey = (inv: Invocation): string => {
  const parts = [inv.role, inv.stage]
  if (inv.issueId !== undefined) parts.push(String(inv.issueId))
  if (inv.prId !== undefined) parts.push(`pr${inv.prId}`)
  return parts.join('-')
}

const sessionPath = (sessionsDir: string, inv: Invocation): string =>
  path.join(sessionsDir, `${sessionKey(inv)}.json`)

export const loadSession = (sessionsDir: string, inv: Invocation): Session | null => {
  try {
    const raw = fs.readFileSync(sessionPath(sessionsDir, inv), 'utf-8')
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export const saveSession = (sessionsDir: string, session: Session): void => {
  fs.mkdirSync(sessionsDir, { recursive: true })
  fs.writeFileSync(
    sessionPath(sessionsDir, session.invocation),
    JSON.stringify({ ...session, updatedAt: new Date().toISOString() }, null, 2),
  )
}

export const clearSession = (sessionsDir: string, inv: Invocation): void => {
  try { fs.unlinkSync(sessionPath(sessionsDir, inv)) } catch { /* not present */ }
}

export const archiveSession = (sessionsDir: string, inv: Invocation): void => {
  const src = sessionPath(sessionsDir, inv)
  const archive = path.join(sessionsDir, `${sessionKey(inv)}-archive-${Date.now()}.json`)
  try { fs.renameSync(src, archive) } catch { /* not present */ }
}
