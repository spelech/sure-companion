import { describe, it, expect } from 'vitest';
import { SettledTransaction, ReceiptMatch, ReceiptAdapter, CategorizationDecision, CategorizationAdapter } from '../src/types';
import { CompanionConfig, CompanionConfigInput, CompanionConfigSchema } from '../src/types/config';

describe('Domain Types', () => {
  it('instantiates a valid SettledTransaction object', () => {
    const tx: SettledTransaction = {
      id: 'tx-123',
      date: '2026-10-10',
      amount: 40.78,
      rawName: 'AMZN Mktp US*1234',
      pending: false,
      excluded: false,
    };
    expect(tx.id).toBe('tx-123');
    expect(tx.pending).toBe(false);
  });

  it('instantiates a valid ReceiptMatch object', () => {
    const receipt: ReceiptMatch = {
      source: 'gmail',
      fileName: 'invoice-123.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('test pdf content'),
      receivedAt: '2026-10-10T12:00:00Z',
    };
    expect(receipt.source).toBe('gmail');
    expect(receipt.fileName).toBe('invoice-123.pdf');
  });

  it('instantiates a valid CategorizationDecision object', () => {
    const decision: CategorizationDecision = {
      categoryName: 'Groceries',
      confidence: 0.95,
      engine: 'rule',
      notes: 'Matched rule for Trader Joe',
    };
    expect(decision.categoryName).toBe('Groceries');
    expect(decision.confidence).toBe(0.95);
  });

  it('instantiates a valid CompanionConfig object', () => {
    const config: CompanionConfig = {
      sure: {
        baseUrl: 'http://sure_web:3000',
        apiToken: 'test-token',
      },
      receipts: {
        provider: 'disabled',
        lookbackDays: 3,
      },
      categorization: {
        provider: 'rules_only',
        rules: [],
      },
      sync: {
        enabled: true,
        intervalMinutes: 60,
        lookbackDays: 14,
        settlementDelayDays: 5,
      },
    };
    expect(config.sure.baseUrl).toBe('http://sure_web:3000');
    expect(config.sync.intervalMinutes).toBe(60);
    expect(config.sync.settlementDelayDays).toBe(5);
  });

  it('validates a default CompanionConfig with Zod schema', () => {
    const inputConfig: CompanionConfigInput = {
      sure: {
        baseUrl: 'http://sure_web:3000',
        apiToken: 'test-token',
      },
      receipts: {
        provider: 'disabled',
      },
      categorization: {
        provider: 'rules_only',
        rules: [],
      },
      sync: {
        intervalMinutes: 60,
      },
    };
    const parsed = CompanionConfigSchema.safeParse(inputConfig);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const config: CompanionConfig = parsed.data;
      expect(config.receipts.lookbackDays).toBe(3);
      expect(config.sync.lookbackDays).toBe(14);
      expect(config.sync.settlementDelayDays).toBe(5);
    }
  });
});
