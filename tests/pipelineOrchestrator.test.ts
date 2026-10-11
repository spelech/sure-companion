import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator';

describe('PipelineOrchestrator', () => {
  let mockSure: any;
  let mockStore: any;
  let mockReceipt: any;
  let mockCategorizer: any;

  beforeEach(() => {
    mockSure = {
      fetchTransactions: vi.fn().mockResolvedValue([]),
      fetchCategories: vi.fn().mockResolvedValue([
        { id: 'cat-retail', name: 'Shopping: General Retail & Household' },
        { id: 'cat-dining', name: 'Dining Out: Fast Food & Coffee' },
        { id: 'cat-utilities', name: 'Utilities: Electric' }
      ]),
      findOrCreateFamilyMerchant: vi.fn().mockResolvedValue('merchant-1'),
      updateTransaction: vi.fn().mockResolvedValue(undefined),
      uploadAttachment: vi.fn().mockResolvedValue(undefined)
    };

    mockStore = {
      isProcessed: vi.fn().mockReturnValue(false),
      recordProcessed: vi.fn(),
      enqueueRetry: vi.fn(),
      getPendingRetries: vi.fn().mockReturnValue([])
    };

    mockCategorizer = {
      categorize: vi.fn().mockResolvedValue({
        categoryName: 'Shopping: General Retail & Household',
        confidence: 0.95,
        engine: 'rule'
      })
    };

    mockReceipt = {
      findReceipt: vi.fn().mockResolvedValue(null)
    };
  });

  it('skips pending transactions and processes settled transactions', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-pending', date: '2026-10-10', amount: 25.0, rawName: 'Dini Ice Cream', pending: true, excluded: false },
      { id: 'tx-settled', date: '2026-10-09', amount: 40.78, rawName: 'Amazon', pending: false, excluded: false }
    ]);

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.totalFetched).toBe(2);
    expect(report.skippedPending).toBe(1);
    expect(report.processedSettled).toBe(1);
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-settled', expect.any(Object));
    expect(mockSure.updateTransaction).not.toHaveBeenCalledWith('tx-pending', expect.any(Object));
  });

  it('skips excluded transactions and increments skippedExcluded', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-excluded', date: '2026-10-10', amount: 15.0, rawName: 'Duplicate Entry', pending: false, excluded: true },
      { id: 'tx-valid', date: '2026-10-10', amount: 15.0, rawName: 'Valid Entry', pending: false, excluded: false }
    ]);

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.totalFetched).toBe(2);
    expect(report.skippedExcluded).toBe(1);
    expect(report.processedSettled).toBe(1);
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-valid', expect.any(Object));
    expect(mockSure.updateTransaction).not.toHaveBeenCalledWith('tx-excluded', expect.any(Object));
  });

  it('skips already processed transactions when amount has not changed', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-already', date: '2026-10-08', amount: 50.0, rawName: 'Target', pending: false, excluded: false },
      { id: 'tx-new', date: '2026-10-08', amount: 30.0, rawName: 'Best Buy', pending: false, excluded: false }
    ]);

    mockStore.isProcessed.mockImplementation((id: string, amount: number) => {
      return id === 'tx-already' && Math.abs(amount - 50.0) < 0.001;
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.totalFetched).toBe(2);
    expect(report.skippedAlreadyProcessed).toBe(1);
    expect(report.processedSettled).toBe(1);
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-new', expect.any(Object));
    expect(mockSure.updateTransaction).not.toHaveBeenCalledWith('tx-already', expect.any(Object));
  });

  it('re-processes a settled transaction if its amount changed from prior hold', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-gas', date: '2026-10-09', amount: 55.40, rawName: 'Shell Oil', pending: false, excluded: false }
    ]);

    // Mock store previously recorded at 40.00, but now settled at 55.40
    mockStore.isProcessed.mockImplementation((id: string, amount: number) => {
      return id === 'tx-gas' && Math.abs(amount - 40.00) < 0.001;
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.skippedAlreadyProcessed).toBe(0);
    expect(report.processedSettled).toBe(1);
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-gas', expect.objectContaining({
      name: 'Shell',
      userModified: true
    }));
    expect(mockStore.recordProcessed).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-gas',
      settledAmount: 55.40
    }));
  });

  it('normalizes merchant name and resolves FamilyMerchant ID with websiteUrl', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-comed', date: '2026-10-05', amount: 120.0, rawName: 'COMED 800-334-7661 BILL PAYMENT', pending: false, excluded: false }
    ]);
    mockSure.findOrCreateFamilyMerchant.mockResolvedValue('merchant-comed-id');

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    await orchestrator.runSync();

    expect(mockSure.findOrCreateFamilyMerchant).toHaveBeenCalledWith('ComEd', 'https://comed.com');
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-comed', expect.objectContaining({
      name: 'ComEd',
      merchantId: 'merchant-comed-id',
      userModified: true
    }));
  });

  it('matches category by name from fetchCategories and assigns categoryId', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-electric', date: '2026-10-05', amount: 120.0, rawName: 'COMED BILL', pending: false, excluded: false }
    ]);
    mockCategorizer.categorize.mockResolvedValue({
      categoryName: 'Utilities: Electric',
      confidence: 0.95,
      engine: 'rule'
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    await orchestrator.runSync();

    expect(mockCategorizer.categorize).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-electric' }),
      ['Shopping: General Retail & Household', 'Dining Out: Fast Food & Coffee', 'Utilities: Electric']
    );
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-electric', expect.objectContaining({
      categoryId: 'cat-utilities'
    }));
    expect(mockStore.recordProcessed).toHaveBeenCalledWith(expect.objectContaining({
      categoryAssigned: 'Utilities: Electric'
    }));
  });

  it('matches receipt and uploads attachment to Sure with receiptStatus matched', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-receipt', date: '2026-10-09', amount: 45.0, rawName: 'Amazon Order', pending: false, excluded: false }
    ]);
    mockReceipt.findReceipt.mockResolvedValue({
      source: 'gmail',
      fileName: 'invoice-123.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('PDF_CONTENT'),
      receivedAt: '2026-10-09T14:00:00Z'
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.receiptsMatched).toBe(1);
    expect(mockSure.uploadAttachment).toHaveBeenCalledWith(
      'tx-receipt',
      expect.any(Buffer),
      'invoice-123.pdf',
      'application/pdf'
    );
    expect(mockStore.recordProcessed).toHaveBeenCalledWith(expect.objectContaining({
      receiptStatus: 'matched'
    }));
  });

  it('fault tolerance: isolates receipt search failure, updates metadata, and enqueues retry', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-search-fail', date: '2026-10-09', amount: 50.0, rawName: 'Amazon', pending: false, excluded: false }
    ]);
    mockReceipt.findReceipt.mockRejectedValue(new Error('Gmail API rate limit exceeded'));

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.processedSettled).toBe(1);
    expect(report.receiptsMatched).toBe(0);
    expect(report.errors).toContainEqual(expect.objectContaining({
      transactionId: 'tx-search-fail',
      error: expect.stringContaining('Receipt search failed')
    }));

    // Metadata update in Sure should still have completed
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-search-fail', expect.objectContaining({
      name: 'Amazon',
      userModified: true
    }));

    // Enqueued in retry queue
    expect(mockStore.enqueueRetry).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-search-fail',
      taskType: 'receipt_fetch'
    }));

    expect(mockStore.recordProcessed).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-search-fail',
      receiptStatus: 'retry'
    }));
  });

  it('fault tolerance: isolates receipt upload failure, updates metadata, and enqueues retry', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-upload-fail', date: '2026-10-09', amount: 50.0, rawName: 'Amazon', pending: false, excluded: false }
    ]);
    mockReceipt.findReceipt.mockResolvedValue({
      source: 'gmail',
      fileName: 'invoice-fail.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('PDF_CONTENT'),
      receivedAt: '2026-10-09T14:00:00Z'
    });
    mockSure.uploadAttachment.mockRejectedValue(new Error('Sure attachment server 500 error'));

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.processedSettled).toBe(1);
    expect(report.receiptsMatched).toBe(0);
    expect(report.errors).toContainEqual(expect.objectContaining({
      transactionId: 'tx-upload-fail',
      error: expect.stringContaining('Receipt upload failed')
    }));

    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-upload-fail', expect.objectContaining({
      name: 'Amazon',
      userModified: true
    }));

    expect(mockStore.enqueueRetry).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-upload-fail',
      taskType: 'receipt_upload'
    }));

    expect(mockStore.recordProcessed).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-upload-fail',
      receiptStatus: 'retry'
    }));
  });

  it('fault tolerance: handles failure in fetchTransactions gracefully without throwing', async () => {
    mockSure.fetchTransactions.mockRejectedValue(new Error('Sure connection refused'));

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.totalFetched).toBe(0);
    expect(report.processedSettled).toBe(0);
    expect(report.errors).toContainEqual(expect.objectContaining({
      error: expect.stringContaining('Failed to fetch transactions')
    }));
  });

  it('continues processing remaining transactions when one transaction update fails', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-fail', date: '2026-10-09', amount: 50.0, rawName: 'Bad Tx', pending: false, excluded: false },
      { id: 'tx-ok', date: '2026-10-09', amount: 60.0, rawName: 'Good Tx', pending: false, excluded: false }
    ]);
    mockSure.updateTransaction.mockImplementation(async (id: string) => {
      if (id === 'tx-fail') throw new Error('Database locked');
      return undefined;
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer);
    const report = await orchestrator.runSync();

    expect(report.totalFetched).toBe(2);
    expect(report.processedSettled).toBe(1);
    expect(report.errors).toContainEqual(expect.objectContaining({
      transactionId: 'tx-fail',
      error: expect.stringContaining('Transaction update failed')
    }));
    expect(mockStore.recordProcessed).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-ok'
    }));
    expect(mockStore.recordProcessed).not.toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-fail'
    }));
  });

  it('passes days option override to fetchTransactions', async () => {
    mockSure.fetchTransactions.mockResolvedValue([]);

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer, { days: 30 });
    await orchestrator.runSync({ days: 7 });

    expect(mockSure.fetchTransactions).toHaveBeenCalledWith(7);
  });

  it('skips receipt search when selectiveReceiptMatching is true and isReceiptRelevant is false', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-gas', date: '2026-10-09', amount: 45.0, rawName: 'SHELL OIL PUMP', pending: false, excluded: false }
    ]);
    mockCategorizer.categorize.mockResolvedValue({
      categoryName: 'Transportation: Gasoline & Fuel',
      confidence: 0.95,
      engine: 'rule',
      isReceiptRelevant: false
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer, {
      selectiveReceiptMatching: true
    });
    const report = await orchestrator.runSync();

    expect(report.processedSettled).toBe(1);
    expect(report.skippedReceiptTriage).toBe(1);
    expect(mockReceipt.findReceipt).not.toHaveBeenCalled();
  });

  it('searches for receipt when selectiveReceiptMatching is disabled even if isReceiptRelevant is false', async () => {
    mockSure.fetchTransactions.mockResolvedValue([
      { id: 'tx-coffee', date: '2026-10-09', amount: 4.5, rawName: 'STARBUCKS', pending: false, excluded: false }
    ]);
    mockCategorizer.categorize.mockResolvedValue({
      categoryName: 'Dining Out: Fast Food & Coffee',
      confidence: 0.95,
      engine: 'rule',
      isReceiptRelevant: false
    });

    const orchestrator = new PipelineOrchestrator(mockSure, mockStore, mockReceipt, mockCategorizer, {
      selectiveReceiptMatching: false
    });
    const report = await orchestrator.runSync();

    expect(report.processedSettled).toBe(1);
    expect(report.skippedReceiptTriage).toBe(0);
    expect(mockReceipt.findReceipt).toHaveBeenCalled();
  });
});
