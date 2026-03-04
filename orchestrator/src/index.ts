import crypto from 'node:crypto'
import express, { type Request, type Response } from 'express'
import { PORT, WEBHOOK_SECRET } from './config.js'
import { routeIssueLabeled, routePrLabeled } from './router.js'

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
  if (event === 'issues' && payload.action === 'labeled') {
    const issue = payload.issue as { number: number; labels: Array<{ name?: string }> }
    const label = (payload.label as { name: string }).name
    await routeIssueLabeled(issue, label)
    return
  }

  if (event === 'pull_request' && payload.action === 'labeled') {
    const pr = payload.pull_request as { number: number; labels: Array<{ name?: string }>; body?: string }
    const label = (payload.label as { name: string }).name
    await routePrLabeled(pr, label)
    return
  }

  console.log(`[webhook] Ignored event: ${event} / ${payload.action}`)
}

app.listen(PORT, () => {
  console.log(`Flower orchestrator listening on port ${PORT}`)
})
