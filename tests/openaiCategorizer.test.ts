import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICategorizer } from '../src/adapters/categorization/openaiCategorizer';

describe('OpenAICategorizer', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports configured when baseUrl and model are present', () => {
    const categorizer = new OpenAICategorizer({
      baseUrl: 'http://localhost:4000/v1',
      model: 'jev-router',
    });
    expect(categorizer.isConfigured()).toBe(true);
    expect(categorizer.id).toBe('openai');
  });

  it('sends prompt with available categories and parses structured output', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              categoryName: 'Shopping: General Retail & Household',
              isReceiptRelevant: true,
              confidence: 0.96,
              reasoning: 'Online purchase from Amazon e-commerce platform',
            }),
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const categorizer = new OpenAICategorizer({
      baseUrl: 'http://localhost:4000/v1',
      model: 'jev-router',
      apiKey: 'test-key',
    });

    const decision = await categorizer.categorize(
      {
        id: 'tx-1',
        date: '2026-10-01',
        amount: 89.99,
        rawName: 'AMAZON.COM*2K4L1M9 SEATTLE WA',
        cleanName: 'Amazon',
        pending: false,
        excluded: false,
      },
      ['Utilities: Electric', 'Shopping: General Retail & Household', 'Dining Out: Fast Food & Coffee']
    );

    expect(decision).not.toBeNull();
    expect(decision?.categoryName).toBe('Shopping: General Retail & Household');
    expect(decision?.isReceiptRelevant).toBe(true);
    expect(decision?.confidence).toBe(0.96);
    expect(decision?.engine).toBe('openai');
    expect(decision?.reasoning).toBe('Online purchase from Amazon e-commerce platform');

    // Verify fetch call was correctly formed
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('marks receipt relevance false for low-probability transactions like gas or ATM', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              categoryName: 'Transportation: Gasoline & Fuel',
              isReceiptRelevant: false,
              confidence: 0.98,
              reasoning: 'In-person fuel pump transaction',
            }),
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const categorizer = new OpenAICategorizer({
      baseUrl: 'http://localhost:4000/v1',
      model: 'jev-router',
    });

    const decision = await categorizer.categorize(
      {
        id: 'tx-2',
        date: '2026-10-02',
        amount: 45.0,
        rawName: 'SHELL OIL 12345',
        cleanName: 'Shell',
        pending: false,
        excluded: false,
      },
      ['Transportation: Gasoline & Fuel']
    );

    expect(decision?.isReceiptRelevant).toBe(false);
    expect(decision?.categoryName).toBe('Transportation: Gasoline & Fuel');
  });

  it('returns null gracefully on network failure without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const categorizer = new OpenAICategorizer({
      baseUrl: 'http://localhost:4000/v1',
      model: 'jev-router',
    });

    const decision = await categorizer.categorize(
      {
        id: 'tx-3',
        date: '2026-10-03',
        amount: 10.0,
        rawName: 'Coffee',
        pending: false,
        excluded: false,
      },
      []
    );

    expect(decision).toBeNull();
  });
});
