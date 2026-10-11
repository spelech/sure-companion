import { describe, it, expect, vi, afterEach } from 'vitest';
import { ReceiptWranglerAdapter } from '../src/adapters/receipt/receiptWranglerAdapter';

describe('ReceiptWranglerAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('queries ReceiptWrangler API and downloads matched receipt image', async () => {
    const mockReceiptsResponse = {
      data: [
        {
          id: 42,
          amount: 67.5,
          date: '2026-10-05T12:00:00Z',
          imageFiles: [
            {
              id: 101,
              fileName: 'home_depot_receipt.jpg',
            },
          ],
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/receipt/group/1')) {
        return {
          ok: true,
          json: async () => mockReceiptsResponse,
        } as any;
      }
      if (url.includes('/api/receiptImage/101/download')) {
        return {
          ok: true,
          headers: new Map([['content-type', 'image/jpeg']]),
          arrayBuffer: async () => Buffer.from('FAKE_IMAGE_DATA'),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const adapter = new ReceiptWranglerAdapter({
      baseUrl: 'http://receiptwrangler:80',
      apiToken: 'rw_token_123',
      groupId: 1,
      lookbackDays: 3,
    });

    const match = await adapter.findReceipt({
      id: 'tx-1',
      date: '2026-10-05',
      amount: 67.5,
      rawName: 'Home Depot',
      pending: false,
      excluded: false,
    });

    expect(match).not.toBeNull();
    expect(match?.source).toBe('receiptwrangler');
    expect(match?.fileName).toBe('home_depot_receipt.jpg');
    expect(match?.fileBuffer.toString()).toBe('FAKE_IMAGE_DATA');
  });

  it('returns null if no receipts match amount or date', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    const adapter = new ReceiptWranglerAdapter({
      baseUrl: 'http://receiptwrangler:80',
    });

    const match = await adapter.findReceipt({
      id: 'tx-2',
      date: '2026-10-05',
      amount: 12.0,
      rawName: 'Bakery',
      pending: false,
      excluded: false,
    });

    expect(match).toBeNull();
  });
});
