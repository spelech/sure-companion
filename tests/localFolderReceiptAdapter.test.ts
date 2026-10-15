import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalFolderReceiptAdapter } from '../src/adapters/receipt/localFolderReceiptAdapter';

describe('LocalFolderReceiptAdapter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipts-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('finds receipt matching amount and date in local folder', async () => {
    const receiptFile = path.join(tempDir, 'amazon_order_45.20_receipt.pdf');
    fs.writeFileSync(receiptFile, 'PDF CONTENT DUMMY');

    const adapter = new LocalFolderReceiptAdapter({
      path: tempDir,
      lookbackDays: 3,
    });

    const match = await adapter.findReceipt({
      id: 'tx-1',
      date: new Date().toISOString().split('T')[0],
      amount: 45.2,
      rawName: 'Amazon',
      pending: false,
      excluded: false,
    });

    expect(match).not.toBeNull();
    expect(match?.fileName).toBe('amazon_order_45.20_receipt.pdf');
    expect(match?.source).toBe('local_folder');
    expect(match?.mimeType).toBe('application/pdf');
    expect(match?.fileBuffer.toString()).toBe('PDF CONTENT DUMMY');
  });

  it('returns null when no matching receipt exists', async () => {
    const receiptFile = path.join(tempDir, 'unrelated_10.00_receipt.pdf');
    fs.writeFileSync(receiptFile, 'PDF CONTENT');

    const adapter = new LocalFolderReceiptAdapter({
      path: tempDir,
      lookbackDays: 3,
    });

    const match = await adapter.findReceipt({
      id: 'tx-2',
      date: new Date().toISOString().split('T')[0],
      amount: 99.99,
      rawName: 'Best Buy',
      pending: false,
      excluded: false,
    });

    expect(match).toBeNull();
  });
});
