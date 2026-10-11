import { describe, it, expect } from 'vitest';
import { normalizeMerchant } from '../src/services/normalizer';

describe('normalizeMerchant', () => {
  it('strips clearinghouse prefixes and location suffixes for core brief examples', () => {
    expect(normalizeMerchant('TST* BIG BOWL - CHICAGO').cleanName).toBe('Big Bowl');
    expect(normalizeMerchant('SQ *COMB & COLLAR').cleanName).toBe('Comb & Collar');
    expect(normalizeMerchant('AMAZON.COM*2K4L1M9 SEATTLE WA').cleanName).toBe('Amazon');
    expect(normalizeMerchant('CHECKCARD 1009 TRADER JOE #687 ROLLING MEADOWS').cleanName).toBe("Trader Joe's");
    expect(normalizeMerchant('COMED 09283742 BILL PAYMENT').cleanName).toBe('ComEd');
  });

  it('normalizes 20+ real bank clearinghouse strings correctly', () => {
    const testCases: Array<{ raw: string; expectedName: string; expectedUrl?: string }> = [
      { raw: 'TST* BIG BOWL - CHICAGO', expectedName: 'Big Bowl' },
      { raw: 'SQ *COMB & COLLAR', expectedName: 'Comb & Collar' },
      { raw: 'AMAZON.COM*2K4L1M9 SEATTLE WA', expectedName: 'Amazon', expectedUrl: 'https://amazon.com' },
      { raw: 'CHECKCARD 1009 TRADER JOE #687 CHICAGO IL', expectedName: "Trader Joe's", expectedUrl: 'https://traderjoes.com' },
      { raw: 'COMED 09283742 BILL PAYMENT', expectedName: 'ComEd', expectedUrl: 'https://comed.com' },
      { raw: 'SP * DRIFTWOOD CAFE', expectedName: 'Driftwood Cafe' },
      { raw: 'PY *PAYPAL INST XFER', expectedName: 'PayPal', expectedUrl: 'https://paypal.com' },
      { raw: 'DEBIT CARD PURCHASE - NICOR GAS AUTOPAY', expectedName: 'Nicor Gas', expectedUrl: 'https://nicorgas.com' },
      { raw: 'POS DEBIT - WHOLEFDS MKT #10293', expectedName: 'Whole Foods Market', expectedUrl: 'https://wholefoodsmarket.com' },
      { raw: 'SHELL OIL 57543210 CHICAGO IL', expectedName: 'Shell' },
      { raw: 'STARBUCKS STORE 08432 SEATTLE WA', expectedName: 'Starbucks Coffee', expectedUrl: 'https://starbucks.com' },
      { raw: "MCDONALD'S F12345 CHICAGO IL", expectedName: "McDonald's", expectedUrl: 'https://mcdonalds.com' },
      { raw: 'TARGET T-0832 MINNEAPOLIS MN', expectedName: 'Target', expectedUrl: 'https://target.com' },
      { raw: 'HOME DEPOT #1923', expectedName: 'The Home Depot', expectedUrl: 'https://homedepot.com' },
      { raw: 'NETFLIX.COM 866-579-7172 CA', expectedName: 'Netflix', expectedUrl: 'https://netflix.com' },
      { raw: 'CHIPOTLE 1234 DENVER CO', expectedName: 'Chipotle Mexican Grill', expectedUrl: 'https://chipotle.com' },
      { raw: 'JEWEL OSCO #3245 CHICAGO IL', expectedName: 'Jewel-Osco', expectedUrl: 'https://jewelosco.com' },
      { raw: 'ALDI 44021 BATAVIA IL', expectedName: 'ALDI', expectedUrl: 'https://aldi.us' },
      { raw: 'WAL-MART #2814 BENTONVILLE AR', expectedName: 'Walmart', expectedUrl: 'https://walmart.com' },
      { raw: 'UBER TRIP 29384 HELP.UBER.COM CA', expectedName: 'Uber', expectedUrl: 'https://uber.com' },
      { raw: 'LYFT *TRIP 12345 SAN FRANCISCO CA', expectedName: 'Lyft', expectedUrl: 'https://lyft.com' },
      { raw: 'VERIZON WRLS *PAYMENT', expectedName: 'Verizon Wireless', expectedUrl: 'https://verizon.com' },
      { raw: 'STAPLES 0192 FRAMINGHAM MA', expectedName: 'Staples', expectedUrl: 'https://staples.com' },
      { raw: 'COSTCO WHSE #0384', expectedName: 'Costco Wholesale', expectedUrl: 'https://costco.com' },
      { raw: 'LOWES #01234', expectedName: "Lowe's", expectedUrl: 'https://lowes.com' }
    ];

    for (const tc of testCases) {
      const result = normalizeMerchant(tc.raw);
      expect(result.cleanName).toBe(tc.expectedName);
      if (tc.expectedUrl) {
        expect(result.websiteUrl).toBe(tc.expectedUrl);
      }
    }
  });

  it('handles unknown merchants gracefully with title casing and noise reduction', () => {
    expect(normalizeMerchant('SQ *AWESOME COFFEE SHOP').cleanName).toBe('Awesome Coffee Shop');
    expect(normalizeMerchant('TST* ROASTED BONE - CHICAGO').cleanName).toBe('Roasted Bone');
    expect(normalizeMerchant('CHECKCARD 1234 RANDOM HARDWARE STORE #99').cleanName).toBe('Random Hardware Store');
  });

  it('handles empty or blank inputs cleanly', () => {
    expect(normalizeMerchant('').cleanName).toBe('Unknown');
    expect(normalizeMerchant('   ').cleanName).toBe('Unknown');
  });
});
