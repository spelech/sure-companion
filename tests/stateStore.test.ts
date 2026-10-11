import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateStore, ProcessedRecord, RetryItem } from '../src/services/stateStore';
import fs from 'fs';
import path from 'path';

describe('StateStore', () => {
  const dbPath = './test_state.db';
  let store: StateStore;

  beforeEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    store = new StateStore(dbPath);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('correctly tracks and checks processed transactions', () => {
    expect(store.isProcessed('tx-1', 40.78)).toBe(false);
    store.recordProcessed({
      transactionId: 'tx-1',
      settledAmount: 40.78,
      merchantAssigned: 'Amazon',
      categoryAssigned: 'Shopping: General Retail & Household',
      receiptStatus: 'matched',
    });
    expect(store.isProcessed('tx-1', 40.78)).toBe(true);
    // If settled amount differs, it should not be considered processed
    expect(store.isProcessed('tx-1', 50.00)).toBe(false);
  });

  it('updates existing processed transaction when settled amount or details change', () => {
    // Initial hold at $40.00
    store.recordProcessed({
      transactionId: 'tx-hold',
      settledAmount: 40.00,
      merchantAssigned: 'Gas Station',
      categoryAssigned: 'Transportation: Fuel',
      receiptStatus: 'pending',
    });
    expect(store.isProcessed('tx-hold', 40.00)).toBe(true);
    expect(store.isProcessed('tx-hold', 65.50)).toBe(false);

    // Final settlement at $65.50
    store.recordProcessed({
      transactionId: 'tx-hold',
      settledAmount: 65.50,
      merchantAssigned: 'Gas Station',
      categoryAssigned: 'Transportation: Fuel',
      receiptStatus: 'matched',
    });
    expect(store.isProcessed('tx-hold', 65.50)).toBe(true);
    expect(store.isProcessed('tx-hold', 40.00)).toBe(false);

    const record = store.getProcessedRecord('tx-hold');
    expect(record).not.toBeNull();
    expect(record?.settledAmount).toBe(65.50);
    expect(record?.receiptStatus).toBe('matched');
  });

  it('handles floating point precision gracefully for settled amounts', () => {
    store.recordProcessed({
      transactionId: 'tx-float',
      settledAmount: 19.99,
      receiptStatus: 'none',
    });
    // Should match exact and within micro-cent float rounding
    expect(store.isProcessed('tx-float', 19.99)).toBe(true);
    expect(store.isProcessed('tx-float', 19.9900000001)).toBe(true);
    expect(store.isProcessed('tx-float', 19.98)).toBe(false);
  });

  it('manages retry queue and retrieves pending retries', () => {
    const now = new Date('2026-10-11T12:00:00Z');
    const past = new Date('2026-10-11T11:00:00Z');
    const future = new Date('2026-10-11T13:00:00Z');

    store.enqueueRetry({
      transactionId: 'tx-due',
      taskType: 'receipt_fetch',
      payloadJson: JSON.stringify({ reason: 'network timeout' }),
      attempts: 1,
      nextAttemptAt: past.toISOString(),
    });

    store.enqueueRetry({
      transactionId: 'tx-future',
      taskType: 'receipt_fetch',
      payloadJson: JSON.stringify({ reason: 'waiting for email delivery' }),
      attempts: 0,
      nextAttemptAt: future.toISOString(),
    });

    const pending = store.getPendingRetries(now);
    expect(pending.length).toBe(1);
    expect(pending[0].transactionId).toBe('tx-due');
    expect(pending[0].taskType).toBe('receipt_fetch');

    // Remove retry after completion
    store.removeRetry('tx-due');
    const pendingAfter = store.getPendingRetries(now);
    expect(pendingAfter.length).toBe(0);
  });

  it('automatically creates parent directory if needed', () => {
    const nestedDir = './test_dir_nested/sub';
    const nestedDbPath = path.join(nestedDir, 'state.db');
    try {
      const nestedStore = new StateStore(nestedDbPath);
      expect(fs.existsSync(nestedDbPath)).toBe(true);
      nestedStore.close();
    } finally {
      if (fs.existsSync(nestedDbPath)) fs.unlinkSync(nestedDbPath);
      if (fs.existsSync(nestedDir)) fs.rmdirSync(nestedDir);
      const parentDir = './test_dir_nested';
      if (fs.existsSync(parentDir)) fs.rmdirSync(parentDir);
    }
  });
});
