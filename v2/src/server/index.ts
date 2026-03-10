// ---------------------------------------------------------------------------
// HTTP server
//
// Endpoints:
//   POST /webhook        — GitHub webhook receiver
//   POST /trigger        — manual agent invocation for testing / human steps
//   GET  /state          — current pipeline state (JSON)
//   GET  /health         — liveness check
//
// No framework — uses Node's built-in http module to keep dependencies lean.
// ---------------------------------------------------------------------------

import http from 'node:http'
import crypto from 'node:crypto'
import type { App } from '../app.js'
import type { Invocation } from '../types/index.js'
import { translateGitHubWebhook } from './github-webhook.js'

export interface ServerConfig {
  port?: number
  // Optional GitHub webhook secret for payload verification
  webhookSecret?: string
}

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const verifySignature = (secret: string, payload: string, sig: string | undefined): boolean => {
  if (!sig) return false
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

const send = (res: http.ServerResponse, status: number, body: unknown): void => {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

export const createServer = (app: App, cfg: ServerConfig = {}): http.Server => {
  const port = cfg.port ?? 3000

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    // ── GET /health ────────────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true })
      return
    }

    // ── GET /state ─────────────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/state') {
      send(res, 200, app.state())
      return
    }

    // ── POST /webhook ──────────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const body = await readBody(req)

      if (cfg.webhookSecret) {
        const sig = req.headers['x-hub-signature-256'] as string | undefined
        if (!verifySignature(cfg.webhookSecret, body, sig)) {
          send(res, 401, { error: 'Invalid signature' })
          return
        }
      }

      const eventName = req.headers['x-github-event'] as string | undefined
      if (!eventName) {
        send(res, 400, { error: 'Missing x-github-event header' })
        return
      }

      let payload: unknown
      try {
        payload = JSON.parse(body)
      } catch {
        send(res, 400, { error: 'Invalid JSON' })
        return
      }

      const event = translateGitHubWebhook(eventName, payload)
      if (event) {
        console.log(`[server] Webhook ${eventName} → ${event.type}`)
        app.handle(event).catch(err => console.error('[server] handle error:', err))
      } else {
        console.log(`[server] Webhook ${eventName} — no pipeline action`)
      }

      send(res, 200, { ok: true })
      return
    }

    // ── POST /trigger ──────────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/trigger') {
      const body = await readBody(req)

      let inv: Partial<Invocation>
      try {
        inv = JSON.parse(body)
      } catch {
        send(res, 400, { error: 'Invalid JSON' })
        return
      }

      if (!inv.role || !inv.stage) {
        send(res, 400, { error: 'role and stage are required' })
        return
      }

      const invocation: Invocation = {
        role: inv.role,
        stage: inv.stage,
        ...(inv.issueId !== undefined && { issueId: inv.issueId }),
        ...(inv.prId !== undefined && { prId: inv.prId }),
        ...(inv.humanComment !== undefined && { humanComment: inv.humanComment }),
      }

      console.log(`[server] Manual trigger: ${invocation.role}/${invocation.stage}`)
      app.executor.enqueueAndProcess([invocation])

      send(res, 202, { queued: true, invocation })
      return
    }

    send(res, 404, { error: 'Not found' })
  })

  server.listen(port, () => {
    console.log(`[server] Listening on http://localhost:${port}`)
    console.log(`[server] Endpoints: POST /webhook  POST /trigger  GET /state  GET /health`)
  })

  return server
}
