import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface ProcessedRecord {
  transactionId: string;
  settledAmount: number;
  merchantAssigned?: string | null;
  categoryAssigned?: string | null;
  receiptStatus: string;
  processedAt?: string;
}

export interface RetryItem {
  transactionId: string;
  taskType: string;
  payloadJson: string;
  attempts: number;
  nextAttemptAt: string;
}

export class StateStore {
  private db: DatabaseType;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(path.resolve(dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_transactions (
        transaction_id TEXT PRIMARY KEY,
        settled_amount REAL NOT NULL,
        merchant_assigned TEXT,
        category_assigned TEXT,
        receipt_status TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS retry_queue (
        transaction_id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        next_attempt_at DATETIME NOT NULL
      );
    `);
  }

  /**
   * Returns true ONLY if the transaction was previously recorded WITH THE EXACT SAME settled amount.
   * If the settled amount differs (e.g. initial authorization hold changed to final posted amount),
   * returns false so the pipeline can re-evaluate with the updated settled amount.
   */
  public isProcessed(transactionId: string, settledAmount: number): boolean {
    const row = this.db
      .prepare('SELECT settled_amount FROM processed_transactions WHERE transaction_id = ?')
      .get(transactionId) as { settled_amount: number } | undefined;

    if (!row) {
      return false;
    }

    // Compare with small sub-cent epsilon for float tolerance
    return Math.abs(row.settled_amount - settledAmount) < 0.001;
  }

  public recordProcessed(record: ProcessedRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO processed_transactions (
        transaction_id,
        settled_amount,
        merchant_assigned,
        category_assigned,
        receipt_status,
        processed_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(transaction_id) DO UPDATE SET
        settled_amount = excluded.settled_amount,
        merchant_assigned = excluded.merchant_assigned,
        category_assigned = excluded.category_assigned,
        receipt_status = excluded.receipt_status,
        processed_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      record.transactionId,
      record.settledAmount,
      record.merchantAssigned ?? null,
      record.categoryAssigned ?? null,
      record.receiptStatus
    );
  }

  public getProcessedRecord(transactionId: string): ProcessedRecord | null {
    const row = this.db
      .prepare(`
        SELECT
          transaction_id AS transactionId,
          settled_amount AS settledAmount,
          merchant_assigned AS merchantAssigned,
          category_assigned AS categoryAssigned,
          receipt_status AS receiptStatus,
          processed_at AS processedAt
        FROM processed_transactions
        WHERE transaction_id = ?
      `)
      .get(transactionId) as ProcessedRecord | undefined;

    return row || null;
  }

  public enqueueRetry(item: RetryItem): void {
    const stmt = this.db.prepare(`
      INSERT INTO retry_queue (
        transaction_id,
        task_type,
        payload_json,
        attempts,
        next_attempt_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(transaction_id) DO UPDATE SET
        task_type = excluded.task_type,
        payload_json = excluded.payload_json,
        attempts = excluded.attempts,
        next_attempt_at = excluded.next_attempt_at
    `);

    stmt.run(
      item.transactionId,
      item.taskType,
      item.payloadJson,
      item.attempts ?? 0,
      item.nextAttemptAt
    );
  }

  public getPendingRetries(asOf: Date = new Date()): RetryItem[] {
    const asOfStr = asOf.toISOString();
    const rows = this.db
      .prepare(`
        SELECT
          transaction_id AS transactionId,
          task_type AS taskType,
          payload_json AS payloadJson,
          attempts,
          next_attempt_at AS nextAttemptAt
        FROM retry_queue
        WHERE next_attempt_at <= ?
        ORDER BY next_attempt_at ASC
      `)
      .all(asOfStr) as RetryItem[];

    return rows;
  }

  public removeRetry(transactionId: string): void {
    this.db.prepare('DELETE FROM retry_queue WHERE transaction_id = ?').run(transactionId);
  }

  public getStats(): { processedCount: number; pendingRetriesCount: number } {
    const processed = (this.db.prepare('SELECT COUNT(*) as count FROM processed_transactions').get() as any)?.count || 0;
    const retries = (this.db.prepare('SELECT COUNT(*) as count FROM retry_queue').get() as any)?.count || 0;
    return {
      processedCount: processed,
      pendingRetriesCount: retries
    };
  }

  public close(): void {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}
