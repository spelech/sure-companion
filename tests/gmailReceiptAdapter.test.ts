import { describe, it, expect, vi } from 'vitest';
import { buildGmailReceiptQuery, GmailReceiptAdapter } from '../src/adapters/receipt/gmailReceiptAdapter';
import { NullReceiptAdapter } from '../src/adapters/receipt/nullReceiptAdapter';
import { SettledTransaction } from '../src/types';

describe('buildGmailReceiptQuery', () => {
  it('constructs strict query matching financial keywords, exact amount, and 3-day window', () => {
    const query = buildGmailReceiptQuery({
      id: 'tx-1',
      date: '2026-10-10',
      amount: 40.78,
      rawName: 'AMAZON.COM',
      cleanName: 'Amazon',
      pending: false,
      excluded: false
    });

    expect(query).toContain('subject:(receipt OR invoice OR "order confirmation" OR bill)');
    expect(query).toContain('("$40.78" OR "40.78")');
    expect(query).toContain('after:2026/10/07');
    expect(query).toContain('before:2026/10/14');
    expect(query).toContain('Amazon');
  });

  it('uses rawName if cleanName is not present', () => {
    const query = buildGmailReceiptQuery({
      id: 'tx-2',
      date: '2026-10-10',
      amount: 15.5,
      rawName: 'COSTCO WHOLESALE #123',
      pending: false,
      excluded: false
    });

    expect(query).toContain('COSTCO WHOLESALE #123');
    expect(query).toContain('("$15.50" OR "15.50")');
  });

  it('handles negative amounts by using absolute value', () => {
    const query = buildGmailReceiptQuery({
      id: 'tx-3',
      date: '2026-10-10',
      amount: -89.99,
      rawName: 'TARGET',
      pending: false,
      excluded: false
    });

    expect(query).toContain('("$89.99" OR "89.99")');
  });

  it('respects custom lookbackDays', () => {
    const query = buildGmailReceiptQuery(
      {
        id: 'tx-4',
        date: '2026-10-10',
        amount: 25.0,
        rawName: 'SHELL',
        pending: false,
        excluded: false
      },
      5
    );

    expect(query).toContain('after:2026/10/05');
    expect(query).toContain('before:2026/10/16');
  });
});

describe('NullReceiptAdapter', () => {
  it('reports not configured and returns null for findReceipt', async () => {
    const adapter = new NullReceiptAdapter();
    expect(adapter.id).toBe('disabled');
    expect(adapter.isConfigured()).toBe(false);

    const match = await adapter.findReceipt({
      id: 'tx-1',
      date: '2026-10-10',
      amount: 10,
      rawName: 'Store',
      pending: false,
      excluded: false
    });
    expect(match).toBeNull();
  });
});

describe('GmailReceiptAdapter', () => {
  it('reports isConfigured false when unconfigured', () => {
    const adapter = new GmailReceiptAdapter();
    expect(adapter.id).toBe('gmail');
    expect(adapter.isConfigured()).toBe(false);
  });

  it('reports isConfigured true when tokens are provided', () => {
    const adapter = new GmailReceiptAdapter({
      clientId: 'mock-client-id',
      clientSecret: 'mock-secret',
      refreshToken: 'mock-refresh-token'
    });
    expect(adapter.isConfigured()).toBe(true);
  });

  it('returns null if not configured when findReceipt is called', async () => {
    const adapter = new GmailReceiptAdapter();
    const result = await adapter.findReceipt({
      id: 'tx-1',
      date: '2026-10-10',
      amount: 10,
      rawName: 'Store',
      pending: false,
      excluded: false
    });
    expect(result).toBeNull();
  });

  it('searches Gmail using strict bounded query and extracts PDF attachment', async () => {
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock content');
    const mockList = vi.fn().mockResolvedValue({
      data: {
        messages: [{ id: 'msg-1' }]
      }
    });
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        id: 'msg-1',
        internalDate: '1728556800000',
        payload: {
          mimeType: 'multipart/mixed',
          parts: [
            {
              filename: 'invoice-12345.pdf',
              mimeType: 'application/pdf',
              body: {
                attachmentId: 'att-1'
              }
            }
          ]
        }
      }
    });
    const mockAttachmentGet = vi.fn().mockResolvedValue({
      data: {
        data: mockPdfBuffer.toString('base64url')
      }
    });

    const mockGmailClient = {
      users: {
        messages: {
          list: mockList,
          get: mockGet,
          attachments: {
            get: mockAttachmentGet
          }
        }
      }
    } as any;

    const adapter = new GmailReceiptAdapter({}, mockGmailClient);
    expect(adapter.isConfigured()).toBe(true);

    const tx: SettledTransaction = {
      id: 'tx-100',
      date: '2026-10-10',
      amount: 40.78,
      rawName: 'AMAZON.COM',
      cleanName: 'Amazon',
      pending: false,
      excluded: false
    };

    const match = await adapter.findReceipt(tx);

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        q: expect.stringContaining('subject:(receipt OR invoice OR "order confirmation" OR bill)')
      })
    );
    expect(match).not.toBeNull();
    expect(match?.source).toBe('gmail');
    expect(match?.fileName).toBe('invoice-12345.pdf');
    expect(match?.mimeType).toBe('application/pdf');
    expect(match?.fileBuffer.toString()).toBe(mockPdfBuffer.toString());
  });

  it('extracts image attachment when PDF is not present', async () => {
    const mockImageBuffer = Buffer.from('mock image bytes');
    const mockList = vi.fn().mockResolvedValue({
      data: {
        messages: [{ id: 'msg-img' }]
      }
    });
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        id: 'msg-img',
        internalDate: '1728556800000',
        payload: {
          mimeType: 'multipart/mixed',
          parts: [
            {
              filename: 'receipt.png',
              mimeType: 'image/png',
              body: {
                attachmentId: 'att-img-1'
              }
            }
          ]
        }
      }
    });
    const mockAttachmentGet = vi.fn().mockResolvedValue({
      data: {
        data: mockImageBuffer.toString('base64url')
      }
    });

    const mockGmailClient = {
      users: {
        messages: {
          list: mockList,
          get: mockGet,
          attachments: {
            get: mockAttachmentGet
          }
        }
      }
    } as any;

    const adapter = new GmailReceiptAdapter({}, mockGmailClient);
    const match = await adapter.findReceipt({
      id: 'tx-101',
      date: '2026-10-10',
      amount: 12.34,
      rawName: 'Cafe',
      pending: false,
      excluded: false
    });

    expect(match).not.toBeNull();
    expect(match?.fileName).toBe('receipt.png');
    expect(match?.mimeType).toBe('image/png');
    expect(match?.fileBuffer.toString()).toBe(mockImageBuffer.toString());
  });

  it('extracts HTML body if no PDF or image attachment exists', async () => {
    const htmlContent = '<html><body><h1>Receipt for $40.78</h1>Order #98765</body></html>';
    const mockList = vi.fn().mockResolvedValue({
      data: {
        messages: [{ id: 'msg-html' }]
      }
    });
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        id: 'msg-html',
        internalDate: '1728556800000',
        payload: {
          mimeType: 'text/html',
          body: {
            data: Buffer.from(htmlContent).toString('base64url')
          }
        }
      }
    });

    const mockGmailClient = {
      users: {
        messages: {
          list: mockList,
          get: mockGet
        }
      }
    } as any;

    const adapter = new GmailReceiptAdapter({}, mockGmailClient);
    const match = await adapter.findReceipt({
      id: 'tx-102',
      date: '2026-10-10',
      amount: 40.78,
      rawName: 'Amazon',
      pending: false,
      excluded: false
    });

    expect(match).not.toBeNull();
    expect(match?.mimeType).toBe('text/html');
    expect(match?.fileBuffer.toString()).toContain('Receipt for $40.78');
  });

  it('returns null when no messages are found in Gmail', async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: {
        messages: []
      }
    });

    const mockGmailClient = {
      users: {
        messages: {
          list: mockList
        }
      }
    } as any;

    const adapter = new GmailReceiptAdapter({}, mockGmailClient);
    const match = await adapter.findReceipt({
      id: 'tx-none',
      date: '2026-10-10',
      amount: 99.99,
      rawName: 'Nowhere',
      pending: false,
      excluded: false
    });

    expect(match).toBeNull();
  });
});
