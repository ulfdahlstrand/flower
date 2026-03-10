import Database from 'better-sqlite3'
import type { Invocation } from '../types/index.js'

// ---------------------------------------------------------------------------
// Persistent queue backed by SQLite.
//
// Why SQLite over the v1 file-based approach:
// - Atomic operations (no stale lock files)
// - Queryable (observability in phase 4 can read directly)
// - Deduplication and reordering are single SQL statements
// - Crash recovery without a separate lock file
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    role        TEXT    NOT NULL,
    stage       TEXT    NOT NULL,
    issue_id    INTEGER,
    pr_id       INTEGER,
    human_comment TEXT,
    status      TEXT    NOT NULL DEFAULT 'pending',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    started_at  TEXT
  );

  -- Index for the common dequeue query
  CREATE INDEX IF NOT EXISTS idx_queue_status ON queue (status, id);
`

export interface QueueRow {
  id: number
  role: string
  stage: string
  issueId: number | null
  prId: number | null
  humanComment: string | null
  status: 'pending' | 'running'
  createdAt: string
  startedAt: string | null
}

export class Queue {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA)
    this._recoverStalledItems()
  }

  // -------------------------------------------------------------------------
  // Enqueue
  // -------------------------------------------------------------------------

  enqueue(invocation: Invocation): { queued: boolean; reason?: string } {
    // Deduplication: skip if the last pending entry is identical
    // (humanComment excluded — it's unique per user message)
    const last = this.db.prepare<[], {
      role: string; stage: string; issue_id: number | null; pr_id: number | null
    }>(
      `SELECT role, stage, issue_id, pr_id FROM queue
       WHERE status = 'pending' ORDER BY id DESC LIMIT 1`
    ).get()

    if (
      last &&
      last.role === invocation.role &&
      last.stage === invocation.stage &&
      last.issue_id === (invocation.issueId ?? null) &&
      last.pr_id === (invocation.prId ?? null)
    ) {
      return { queued: false, reason: 'duplicate' }
    }

    this.db.prepare(
      `INSERT INTO queue (role, stage, issue_id, pr_id, human_comment)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      invocation.role,
      invocation.stage,
      invocation.issueId ?? null,
      invocation.prId ?? null,
      invocation.humanComment ?? null,
    )

    return { queued: true }
  }

  // -------------------------------------------------------------------------
  // Dequeue — atomically marks the first pending item as running.
  // Returns null if the queue is empty or something is already running.
  // -------------------------------------------------------------------------

  dequeueNext(): (QueueRow & { invocation: Invocation }) | null {
    const next = this.db.transaction(() => {
      // Only one item runs at a time
      const running = this.db.prepare<[], { id: number }>(
        `SELECT id FROM queue WHERE status = 'running' LIMIT 1`
      ).get()
      if (running) return null

      const row = this.db.prepare<[], {
        id: number; role: string; stage: string
        issue_id: number | null; pr_id: number | null; human_comment: string | null
        status: string; created_at: string; started_at: string | null
      }>(
        `SELECT * FROM queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
      ).get()
      if (!row) return null

      this.db.prepare(
        `UPDATE queue SET status = 'running', started_at = datetime('now') WHERE id = ?`
      ).run(row.id)

      return row
    })()

    if (!next) return null

    return {
      id: next.id,
      role: next.role,
      stage: next.stage,
      issueId: next.issue_id,
      prId: next.pr_id,
      humanComment: next.human_comment,
      status: 'running',
      createdAt: next.created_at,
      startedAt: next.started_at,
      invocation: {
        role: next.role as Invocation['role'],
        stage: next.stage,
        ...(next.issue_id !== null && { issueId: next.issue_id }),
        ...(next.pr_id !== null && { prId: next.pr_id }),
        ...(next.human_comment !== null && { humanComment: next.human_comment }),
      },
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  complete(id: number): void {
    this.db.prepare(`DELETE FROM queue WHERE id = ?`).run(id)
  }

  // Called when an agent crashes mid-run — reset to pending so it retries
  fail(id: number): void {
    this.db.prepare(
      `UPDATE queue SET status = 'pending', started_at = NULL WHERE id = ?`
    ).run(id)
  }

  // -------------------------------------------------------------------------
  // Observability
  // -------------------------------------------------------------------------

  getPending(): QueueRow[] {
    return this.db.prepare<[], {
      id: number; role: string; stage: string
      issue_id: number | null; pr_id: number | null; human_comment: string | null
      status: string; created_at: string; started_at: string | null
    }>(
      `SELECT * FROM queue WHERE status = 'pending' ORDER BY id ASC`
    ).all().map(r => ({
      id: r.id,
      role: r.role,
      stage: r.stage,
      issueId: r.issue_id,
      prId: r.pr_id,
      humanComment: r.human_comment,
      status: 'pending' as const,
      createdAt: r.created_at,
      startedAt: r.started_at,
    }))
  }

  getRunning(): QueueRow | null {
    const r = this.db.prepare<[], {
      id: number; role: string; stage: string
      issue_id: number | null; pr_id: number | null; human_comment: string | null
      status: string; created_at: string; started_at: string | null
    }>(`SELECT * FROM queue WHERE status = 'running' LIMIT 1`).get()
    if (!r) return null
    return {
      id: r.id, role: r.role, stage: r.stage,
      issueId: r.issue_id, prId: r.pr_id, humanComment: r.human_comment,
      status: 'running', createdAt: r.created_at, startedAt: r.started_at,
    }
  }

  size(): number {
    const result = this.db.prepare<[], { count: number }>(
      `SELECT COUNT(*) as count FROM queue WHERE status = 'pending'`
    ).get()
    return result?.count ?? 0
  }

  // -------------------------------------------------------------------------
  // Crash recovery — on startup, reset any items stuck as 'running'
  // (the process that was running them is gone)
  // -------------------------------------------------------------------------

  private _recoverStalledItems(): void {
    const { changes } = this.db.prepare(
      `UPDATE queue SET status = 'pending', started_at = NULL WHERE status = 'running'`
    ).run()
    if (changes > 0) {
      console.warn(`[queue] Recovered ${changes} stalled item(s) from previous run`)
    }
  }

  close(): void {
    this.db.close()
  }
}
