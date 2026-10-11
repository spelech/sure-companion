import { describe, it, expect } from 'vitest';
import { RuleCategorizer } from '../src/adapters/categorization/ruleCategorizer';
import { CANONICAL_CATEGORIES, Rule } from '../src/services/ruleEngine';

describe('RuleCategorizer', () => {
  const categorizer = new RuleCategorizer();

  it('implements CategorizationAdapter interface', () => {
    expect(categorizer.id).toBe('rule');
    expect(categorizer.isConfigured()).toBe(true);
  });

  it('contains exactly 39 canonical categories in the canonical taxonomy', () => {
    expect(CANONICAL_CATEGORIES).toHaveLength(39);
    expect(CANONICAL_CATEGORIES).toContain('Utilities: Electric');
    expect(CANONICAL_CATEGORIES).toContain('Groceries & Supermarket');
    expect(CANONICAL_CATEGORIES).toContain('Dining Out: Fast Food & Coffee');
    expect(CANONICAL_CATEGORIES).toContain('Dining Out: Restaurants & Takeout');
    expect(CANONICAL_CATEGORIES).toContain('Dining Out: Workplace Meals');
    expect(CANONICAL_CATEGORIES).toContain('Housing: Mortgage Principal & Interest');
    expect(CANONICAL_CATEGORIES).toContain('Housing: Home Maintenance & Improvement');
    expect(CANONICAL_CATEGORIES).toContain('Housing: Home Furnishings');
    expect(CANONICAL_CATEGORIES).toContain('Housing: Real Estate Taxes');
    expect(CANONICAL_CATEGORIES).toContain('Housing: Rent & Temporary Housing');
    expect(CANONICAL_CATEGORIES).toContain('Utilities: Gas');
    expect(CANONICAL_CATEGORIES).toContain('Utilities: Internet & Cable');
    expect(CANONICAL_CATEGORIES).toContain('Utilities: Cell Phone');
    expect(CANONICAL_CATEGORIES).toContain('Utilities: Water & Waste');
    expect(CANONICAL_CATEGORIES).toContain('Education & Childcare');
    expect(CANONICAL_CATEGORIES).toContain('Medical & Healthcare');
    expect(CANONICAL_CATEGORIES).toContain('Transportation: Gasoline & Fuel');
    expect(CANONICAL_CATEGORIES).toContain('Transportation: Tolls & Transit');
    expect(CANONICAL_CATEGORIES).toContain('Transportation: Auto Insurance & Care');
    expect(CANONICAL_CATEGORIES).toContain('Debt Service: Vehicle Financing');
    expect(CANONICAL_CATEGORIES).toContain('Entertainment: Streaming & Media');
    expect(CANONICAL_CATEGORIES).toContain('Entertainment: Hobbies & Recreation');
    expect(CANONICAL_CATEGORIES).toContain('Technology: Software & Subscriptions');
    expect(CANONICAL_CATEGORIES).toContain('Pets & Pet Care');
    expect(CANONICAL_CATEGORIES).toContain('Shopping: General Retail & Household');
    expect(CANONICAL_CATEGORIES).toContain('Shopping: Clothing & Apparel');
    expect(CANONICAL_CATEGORIES).toContain('Shopping: Electronics & Technology');
    expect(CANONICAL_CATEGORIES).toContain('Personal Care & Fitness');
    expect(CANONICAL_CATEGORIES).toContain('Travel, Lodging & Vacation');
    expect(CANONICAL_CATEGORIES).toContain('Legal, Professional & Taxes');
    expect(CANONICAL_CATEGORIES).toContain('Transfer: Internal Liquidity');
    expect(CANONICAL_CATEGORIES).toContain('Transfer: Interspousal');
    expect(CANONICAL_CATEGORIES).toContain('Transfer: Family Reimbursement');
    expect(CANONICAL_CATEGORIES).toContain('Transfer: Peer-to-Peer & Personal Reimbursements');
    expect(CANONICAL_CATEGORIES).toContain('Investment: Brokerage & Capital Accumulation');
    expect(CANONICAL_CATEGORIES).toContain('Income: Payroll');
    expect(CANONICAL_CATEGORIES).toContain('Income: Interest & Passive');
    expect(CANONICAL_CATEGORIES).toContain('Income: Health / HSA Reimbursement');
    expect(CANONICAL_CATEGORIES).toContain('General & Miscellaneous');
  });

  it('categorizes known utilities and food merchants accurately', async () => {
    const electric = await categorizer.categorize({
      id: '1', date: '2026-10-01', amount: 145.20, rawName: 'COMED BILL PAYMENT', cleanName: 'ComEd', pending: false, excluded: false
    }, []);
    expect(electric?.categoryName).toBe('Utilities: Electric');
    expect(electric?.engine).toBe('rule');
    expect(electric?.confidence).toBeGreaterThanOrEqual(0.9);

    const groceries = await categorizer.categorize({
      id: '2', date: '2026-10-02', amount: 89.40, rawName: 'TRADER JOES #687', cleanName: "Trader Joe's", pending: false, excluded: false
    }, []);
    expect(groceries?.categoryName).toBe('Groceries & Supermarket');
    expect(groceries?.engine).toBe('rule');
  });

  it('categorizes dining into fast food vs restaurant vs workplace', async () => {
    const mcd = await categorizer.categorize({
      id: '3', date: '2026-10-03', amount: 12.50, rawName: 'MCDONALD #1029', cleanName: "McDonald's", pending: false, excluded: false
    }, []);
    expect(mcd?.categoryName).toBe('Dining Out: Fast Food & Coffee');

    const pizza = await categorizer.categorize({
      id: '4', date: '2026-10-03', amount: 54.00, rawName: 'LOU MALNATI PIZZERIA', cleanName: "Lou Malnati's Pizzeria", pending: false, excluded: false
    }, []);
    expect(pizza?.categoryName).toBe('Dining Out: Restaurants & Takeout');

    const workMeal = await categorizer.categorize({
      id: '5', date: '2026-10-04', amount: 8.75, rawName: 'ARAMARK WORKPLACE CAFE', cleanName: 'Aramark Cafeteria', pending: false, excluded: false
    }, []);
    expect(workMeal?.categoryName).toBe('Dining Out: Workplace Meals');
  });

  it('categorizes transportation, fuel, tolls, and auto care', async () => {
    const gas = await categorizer.categorize({
      id: '6', date: '2026-10-04', amount: 45.00, rawName: 'SHELL OIL 123456', cleanName: 'Shell', pending: false, excluded: false
    }, []);
    expect(gas?.categoryName).toBe('Transportation: Gasoline & Fuel');

    const toll = await categorizer.categorize({
      id: '7', date: '2026-10-04', amount: 20.00, rawName: 'ILLINOIS TOLLWAY AUTO REPLENISH', cleanName: 'Illinois Tollway (I-PASS)', pending: false, excluded: false
    }, []);
    expect(toll?.categoryName).toBe('Transportation: Tolls & Transit');

    const autoCare = await categorizer.categorize({
      id: '8', date: '2026-10-05', amount: 29.99, rawName: 'AUTOZONE #4592', cleanName: 'AutoZone', pending: false, excluded: false
    }, []);
    expect(autoCare?.categoryName).toBe('Transportation: Auto Insurance & Care');
  });

  it('categorizes pets, childcare, healthcare, and streaming', async () => {
    const pet = await categorizer.categorize({
      id: '9', date: '2026-10-05', amount: 62.50, rawName: 'CHEWY.COM', cleanName: 'Chewy.com', pending: false, excluded: false
    }, []);
    expect(pet?.categoryName).toBe('Pets & Pet Care');

    const daycare = await categorizer.categorize({
      id: '10', date: '2026-10-06', amount: 450.00, rawName: 'KINDERCARE LEARNING CENTER TUITION', cleanName: 'Daycare & Preschool', pending: false, excluded: false
    }, []);
    expect(daycare?.categoryName).toBe('Education & Childcare');

    const health = await categorizer.categorize({
      id: '11', date: '2026-10-06', amount: 25.00, rawName: 'NORTHWEST COMMUNITY HEALTHCARE', cleanName: 'Northwest Community Healthcare', pending: false, excluded: false
    }, []);
    expect(health?.categoryName).toBe('Medical & Healthcare');

    const netflix = await categorizer.categorize({
      id: '12', date: '2026-10-06', amount: 15.49, rawName: 'NETFLIX.COM', cleanName: 'Netflix', pending: false, excluded: false
    }, []);
    expect(netflix?.categoryName).toBe('Entertainment: Streaming & Media');
  });

  it('categorizes banking, internal liquidity, interspousal, and payroll transfers', async () => {
    const ccPay = await categorizer.categorize({
      id: '13', date: '2026-10-07', amount: 500.00, rawName: 'AUTOMATIC PAYMENT - THANK YOU', cleanName: 'Chase Credit Card Payment', pending: false, excluded: false
    }, []);
    expect(ccPay?.categoryName).toBe('Transfer: Internal Liquidity');

    const interspousal = await categorizer.categorize({
      id: '14', date: '2026-10-07', amount: 100.00, rawName: 'Zelle payment - INTERSPOUSAL TRANSFER', cleanName: 'Interspousal Transfer', pending: false, excluded: false
    }, []);
    expect(interspousal?.categoryName).toBe('Transfer: Interspousal');

    const payroll = await categorizer.categorize({
      id: '15', date: '2026-10-08', amount: -3200.00, rawName: 'PAYROLL DIRECT DEP - ACME CORP', cleanName: 'Employer Direct Deposit', pending: false, excluded: false
    }, []);
    expect(payroll?.categoryName).toBe('Income: Payroll');
  });

  it('supports custom rule overrides with priority ordering', async () => {
    const customRules: Rule[] = [
      {
        pattern: 'SPECIAL_STORE',
        rawPattern: 'SPECIAL_STORE',
        matchField: 'raw_description',
        targetCategory: 'Shopping: General Retail & Household',
        priority: 5,
        isActive: true,
      },
      {
        pattern: 'SPECIAL_STORE_OVERRIDE',
        rawPattern: 'SPECIAL_STORE',
        matchField: 'raw_description',
        targetCategory: 'Entertainment: Hobbies & Recreation',
        priority: 1, // Higher priority (lower number)
        isActive: true,
      },
    ];

    const customCategorizer = new RuleCategorizer(customRules);
    const result = await customCategorizer.categorize({
      id: '16', date: '2026-10-08', amount: 50.00, rawName: 'SPECIAL_STORE PURCHASE', cleanName: 'Special Store', pending: false, excluded: false
    }, []);

    expect(result?.categoryName).toBe('Entertainment: Hobbies & Recreation');
  });

  it('returns null when no rule matches an unknown merchant', async () => {
    const unknown = await categorizer.categorize({
      id: '17', date: '2026-10-09', amount: 19.99, rawName: 'RANDOM UNKNOWN XYZ MERCHANT 9999', cleanName: 'Unknown Corp', pending: false, excluded: false
    }, []);
    expect(unknown).toBeNull();
  });

  it('validates against availableCategories when non-empty list is provided', async () => {
    // If availableCategories is provided and includes the category, return it
    const match = await categorizer.categorize({
      id: '18', date: '2026-10-09', amount: 100.00, rawName: 'COMED ELECTRIC', cleanName: 'ComEd', pending: false, excluded: false
    }, ['Utilities: Electric', 'Housing: Rent & Temporary Housing']);
    expect(match?.categoryName).toBe('Utilities: Electric');

    // If availableCategories does not contain the match, it falls back or returns null
    const noMatch = await categorizer.categorize({
      id: '19', date: '2026-10-09', amount: 100.00, rawName: 'COMED ELECTRIC', cleanName: 'ComEd', pending: false, excluded: false
    }, ['Housing: Rent & Temporary Housing']);
    expect(noMatch).toBeNull();
  });
});
