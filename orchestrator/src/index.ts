import crypto from 'node:crypto'
import express, { type Request, type Response } from 'express'
import { PORT, WEBHOOK_SECRET } from './config.js'
import { routeIssueLabeled, routePrLabeled, routeIssueComment, routeIssueClosed, routePrMerged, runStartupCascadeCheck } from './router.js'
import { runAgent } from './loop.js'
import type { InvocationParams } from './types.js'

const app = express()

app.use(express.json({
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf
  },
}))

const verifySignature = (req: Request & { rawBody?: Buffer }): boolean => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  if (!signature) return false
  const expected = `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.rawBody ?? '').digest('hex')}`
  // timingSafeEqual requires equal-length buffers
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return false
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

app.post('/webhook', async (req: Request & { rawBody?: Buffer }, res: Response) => {
  if (!verifySignature(req)) {
    res.status(401).send('Invalid signature')
    return
  }

  const event = req.headers['x-github-event'] as string
  const payload = req.body

  // Acknowledge immediately — GitHub expects a fast response
  res.status(202).send('Accepted')

  handleEvent(event, payload).catch(err => {
    console.error(`[webhook] Unhandled error for event "${event}":`, err)
  })
})

const handleEvent = async (event: string, payload: Record<string, unknown>): Promise<void> => {
  if (event === 'issues' && payload.action === 'closed') {
    const issue = payload.issue as { number: number; body?: string }
    await routeIssueClosed(issue.number, issue.body)
    return
  }

  if (event === 'issues' && payload.action === 'labeled') {
    const issue = payload.issue as { number: number; labels: Array<{ name?: string }> }
    const label = (payload.label as { name: string }).name
    await routeIssueLabeled(issue, label)
    return
  }

  if (event === 'pull_request' && payload.action === 'closed') {
    const pr = payload.pull_request as { number: number; merged: boolean; body?: string }
    if (pr.merged) {
      await routePrMerged(pr.number, pr.body)
    }
    return
  }

  if (event === 'pull_request' && payload.action === 'labeled') {
    const pr = payload.pull_request as { number: number; labels: Array<{ name?: string }>; body?: string }
    const label = (payload.label as { name: string }).name
    await routePrLabeled(pr, label)
    return
  }

  if (event === 'issue_comment' && payload.action === 'created') {
    const comment = payload.comment as { user: { type: string }; body: string }
    const issue = payload.issue as { number: number; labels: Array<{ name?: string }>; pull_request?: unknown }
    if (comment.user.type === 'Bot') {
      console.log(`[webhook] Ignoring bot comment on #${issue.number}`)
      return
    }
    if (/^\[(PM|ARCHITECT|REQUIREMENTS|DEVELOPER|TESTER|REVIEWER)\]/i.test(comment.body)) {
      console.log(`[webhook] Ignoring agent comment on #${issue.number}`)
      return
    }
    if (issue.pull_request) {
      console.log(`[webhook] Ignoring comment on PR #${issue.number}`)
      return
    }
    await routeIssueComment(issue, comment.body)
    return
  }

  console.log(`[webhook] Ignored event: ${event} / ${payload.action}`)
}

// Manual trigger endpoint — bypasses webhook signature requirement
// Usage: POST /trigger with InvocationParams JSON body
app.post('/trigger', (req: Request, res: Response) => {
  const params = req.body as InvocationParams
  if (!params?.agent) {
    res.status(400).json({ error: 'Request body must include at least { agent }' })
    return
  }
  res.status(202).json({ message: `Dispatching ${params.agent}`, params })
  runAgent(params).catch(err => {
    console.error(`[trigger] Unhandled error for agent "${params.agent}":`, err)
  })
})

app.listen(PORT, () => {
  console.log(`Flower orchestrator listening on port ${PORT}`)
  runStartupCascadeCheck().catch(err =>
    console.error('[startup] Cascade check failed:', err),
  )
})
