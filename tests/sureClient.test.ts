import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SureClient } from '../src/services/sureClient';

describe('SureClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats PATCH payload with user_modified=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'tx-1', status: 'updated' })
    });
    global.fetch = fetchMock;

    const client = new SureClient('http://localhost:3000', 'mock-token');
    await client.updateTransaction('tx-1', {
      merchantId: 'm-1',
      categoryId: 'c-1',
      notes: 'Audited by Sure Companion'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/transactions/tx-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          transaction: {
            merchant_id: 'm-1',
            category_id: 'c-1',
            notes: 'Audited by Sure Companion',
            user_modified: true
          }
        })
      })
    );
  });

  describe('fetchTransactions', () => {
    it('fetches recent transactions and maps them to SettledTransaction', async () => {
      const mockApiResponse = {
        transactions: [
          {
            id: 'tx-1',
            date: '2026-10-10',
            amount: '$40.78',
            amount_cents: 4078,
            name: 'AMAZON.COM*2K4L1M9',
            merchant: { id: 'm-1', name: 'Amazon' },
            category: { id: 'c-1', name: 'Shopping' },
            pending: false,
            excluded: false,
            currency: 'USD'
          },
          {
            id: 'tx-2',
            date: '2026-10-11',
            amount: '25.00',
            name: 'DINIS ICE CREAM',
            extra: {
              simplefin: {
                pending: true
              }
            },
            excluded: false
          },
          {
            id: 'tx-3',
            date: '2026-10-09',
            amount: 15.50,
            name: 'ATM FEE',
            status: 'pending',
            excluded: true
          }
        ]
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'mock-token');
      const transactions = await client.fetchTransactions(14);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/transactions?'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );

      expect(transactions).toHaveLength(3);

      expect(transactions[0]).toEqual({
        id: 'tx-1',
        date: '2026-10-10',
        amount: 40.78,
        rawName: 'AMAZON.COM*2K4L1M9',
        cleanName: 'Amazon',
        merchantId: 'm-1',
        categoryId: 'c-1',
        pending: false,
        excluded: false,
        currency: 'USD'
      });

      expect(transactions[1].pending).toBe(true);
      expect(transactions[1].amount).toBe(25.00);

      expect(transactions[2].pending).toBe(true);
      expect(transactions[2].excluded).toBe(true);
      expect(transactions[2].amount).toBe(15.50);
    });

    it('handles direct array responses for transactions', async () => {
      const mockList = [
        {
          id: 'tx-direct',
          date: '2026-10-08',
          amount: 100.0,
          name: 'Direct Array Store',
          pending: false,
          excluded: false
        }
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockList
      });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'mock-token');
      const transactions = await client.fetchTransactions(7);

      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe('tx-direct');
      expect(transactions[0].pending).toBe(false);
    });
  });

  describe('fetchCategories', () => {
    it('retrieves existing categories and maps them', async () => {
      const mockCategories = {
        categories: [
          { id: 'cat-1', name: 'Utilities: Electric', color: '#eab308', icon: 'zap' },
          { id: 'cat-2', name: 'Groceries & Supermarket', color: '#22c55e', icon: 'shopping-cart' }
        ]
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCategories
      });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'mock-token');
      const categories = await client.fetchCategories();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/categories',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );

      expect(categories).toEqual([
        { id: 'cat-1', name: 'Utilities: Electric', color: '#eab308', icon: 'zap' },
        { id: 'cat-2', name: 'Groceries & Supermarket', color: '#22c55e', icon: 'shopping-cart' }
      ]);
    });
  });

  describe('findOrCreateFamilyMerchant', () => {
    it('returns existing merchant id when merchant is found (case-insensitive)', async () => {
      const mockMerchants = [
        { id: 'm-trader-joes', name: "Trader Joe's", type: 'FamilyMerchant' },
        { id: 'm-amazon', name: 'Amazon', type: 'FamilyMerchant' }
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMerchants
      });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'mock-token');
      const id = await client.findOrCreateFamilyMerchant('trader joe\'s');

      expect(id).toBe('m-trader-joes');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/merchants',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );
    });

    it('creates new FamilyMerchant when merchant is not found', async () => {
      const mockMerchants = [
        { id: 'm-amazon', name: 'Amazon', type: 'FamilyMerchant' }
      ];

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMerchants
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            imported: 1,
            merchants: [{ id: 'm-new-coffee', name: 'Coffee Lab', type: 'FamilyMerchant' }]
          })
        });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'mock-token');
      const id = await client.findOrCreateFamilyMerchant('Coffee Lab', 'https://coffeelab.com');

      expect(id).toBe('m-new-coffee');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://localhost:3000/api/v1/merchants',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );
    });
  });

  describe('uploadAttachment', () => {
    it('uploads receipt file as multipart/form-data to /api/v1/transactions/:id/attachments', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'att-1', filename: 'receipt.pdf' })
      });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'mock-token');
      const fileBuffer = Buffer.from('%PDF-1.4 mock pdf receipt');

      await client.uploadAttachment('tx-1', fileBuffer, 'receipt.pdf', 'application/pdf');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/transactions/tx-1/attachments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          }),
          body: expect.any(FormData)
        })
      );
    });
  });

  describe('error handling', () => {
    it('throws formatted error on API failure', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'invalid_token', message: 'Token expired' })
      });
      global.fetch = fetchMock;

      const client = new SureClient('http://localhost:3000', 'bad-token');

      await expect(client.fetchCategories()).rejects.toThrow(
        /Sure API error \(401 Unauthorized\)/
      );
    });
  });
});
