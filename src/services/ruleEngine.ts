export const CANONICAL_CATEGORIES = [
  'Income: Payroll',
  'Income: Interest & Passive',
  'Income: Health / HSA Reimbursement',
  'Housing: Mortgage Principal & Interest',
  'Housing: Home Maintenance & Improvement',
  'Housing: Home Furnishings',
  'Housing: Real Estate Taxes',
  'Housing: Rent & Temporary Housing',
  'Utilities: Electric',
  'Utilities: Gas',
  'Utilities: Internet & Cable',
  'Utilities: Cell Phone',
  'Utilities: Water & Waste',
  'Groceries & Supermarket',
  'Dining Out: Restaurants & Takeout',
  'Dining Out: Fast Food & Coffee',
  'Dining Out: Workplace Meals',
  'Education & Childcare (Goddard School)',
  'Medical & Healthcare',
  'Transportation: Gasoline & Fuel',
  'Transportation: Tolls & Transit',
  'Transportation: Auto Insurance & Care',
  'Debt Service: Vehicle Financing (Acura RDX)',
  'Entertainment: Streaming & Media',
  'Entertainment: Hobbies & Recreation',
  'Technology: Software & Subscriptions',
  'Pets & Pet Care (Riley)',
  'Shopping: General Retail & Household',
  'Shopping: Clothing & Apparel',
  'Shopping: Electronics & Technology',
  'Personal Care & Fitness',
  'Travel, Lodging & Vacation',
  'Legal, Professional & Taxes',
  'Transfer: Internal Liquidity',
  'Transfer: Interspousal (Laura Pelech)',
  'Transfer: Family Reimbursement',
  'Transfer: Peer-to-Peer & Personal Reimbursements',
  'Investment: Brokerage & Capital Accumulation',
  'General & Miscellaneous',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

export interface Rule {
  id?: string;
  pattern?: string;
  rawPattern?: string;
  cleanPattern?: string;
  matchField?: 'raw_description' | 'clean_name' | 'dual';
  targetMerchant?: string;
  targetCategory: string;
  targetTags?: string[];
  priority?: number;
  isActive?: boolean | number;
}

export interface RuleMatchResult {
  matched: boolean;
  ruleId?: string;
  vendor?: string;
  category?: string;
  tags?: string[];
  confidence?: number;
}

export const CATEGORY_NORMALIZATION_MAP: Record<string, CanonicalCategory> = {
  // Utilities
  'utilities: electric': 'Utilities: Electric',
  'utilities-electric': 'Utilities: Electric',
  'electric': 'Utilities: Electric',
  'utilities: gas': 'Utilities: Gas',
  'utilities-gas': 'Utilities: Gas',
  'gas heating': 'Utilities: Gas',
  'natural gas': 'Utilities: Gas',
  'utilities: internet': 'Utilities: Internet & Cable',
  'utilities: internet & cable': 'Utilities: Internet & Cable',
  'utilities-internet': 'Utilities: Internet & Cable',
  'internet': 'Utilities: Internet & Cable',
  'cable': 'Utilities: Internet & Cable',
  'utilities: cell phone': 'Utilities: Cell Phone',
  'utilities-cell-phone': 'Utilities: Cell Phone',
  'cell phone': 'Utilities: Cell Phone',
  'telephone': 'Utilities: Cell Phone',
  'utilities: waste': 'Utilities: Water & Waste',
  'utilities: water & waste': 'Utilities: Water & Waste',
  'water': 'Utilities: Water & Waste',
  'waste': 'Utilities: Water & Waste',

  // Groceries & Dining
  'groceries': 'Groceries & Supermarket',
  'groceries & supermarket': 'Groceries & Supermarket',
  'supermarket': 'Groceries & Supermarket',
  'dining out': 'Dining Out: Restaurants & Takeout',
  'dining out: restaurants & takeout': 'Dining Out: Restaurants & Takeout',
  'dining out: fast food & coffee': 'Dining Out: Fast Food & Coffee',
  'fast food': 'Dining Out: Fast Food & Coffee',
  'coffee': 'Dining Out: Fast Food & Coffee',
  'dining out: workplace meals': 'Dining Out: Workplace Meals',
  'workplace meals': 'Dining Out: Workplace Meals',
  'cafeteria': 'Dining Out: Workplace Meals',

  // Housing
  'housing: mortgage principal & interest': 'Housing: Mortgage Principal & Interest',
  'mortgage': 'Housing: Mortgage Principal & Interest',
  'housing: home maintenance & improvement': 'Housing: Home Maintenance & Improvement',
  'home maintenance': 'Housing: Home Maintenance & Improvement',
  'home improvement': 'Housing: Home Maintenance & Improvement',
  'home repair / reno': 'Housing: Home Maintenance & Improvement',
  'housing: home furnishings': 'Housing: Home Furnishings',
  'home furnishings': 'Housing: Home Furnishings',
  'furniture': 'Housing: Home Furnishings',
  'housing: real estate taxes': 'Housing: Real Estate Taxes',
  'real estate taxes': 'Housing: Real Estate Taxes',
  'property tax': 'Housing: Real Estate Taxes',
  'housing: rent & temporary housing': 'Housing: Rent & Temporary Housing',
  'rent': 'Housing: Rent & Temporary Housing',

  // Education & Health
  'education & childcare (goddard school)': 'Education & Childcare (Goddard School)',
  'education & childcare': 'Education & Childcare (Goddard School)',
  'childcare': 'Education & Childcare (Goddard School)',
  'daycare': 'Education & Childcare (Goddard School)',
  'medical & healthcare': 'Medical & Healthcare',
  'healthcare & medical': 'Medical & Healthcare',
  'medical': 'Medical & Healthcare',
  'healthcare': 'Medical & Healthcare',
  'pharmacy': 'Medical & Healthcare',

  // Transportation & Auto
  'transportation: gasoline & fuel': 'Transportation: Gasoline & Fuel',
  'transportation: gas': 'Transportation: Gasoline & Fuel',
  'gasoline': 'Transportation: Gasoline & Fuel',
  'fuel': 'Transportation: Gasoline & Fuel',
  'transportation: tolls & transit': 'Transportation: Tolls & Transit',
  'transportation': 'Transportation: Tolls & Transit',
  'tolls': 'Transportation: Tolls & Transit',
  'transit': 'Transportation: Tolls & Transit',
  'rideshare': 'Transportation: Tolls & Transit',
  'transportation: auto insurance & care': 'Transportation: Auto Insurance & Care',
  'insurance': 'Transportation: Auto Insurance & Care',
  'auto insurance': 'Transportation: Auto Insurance & Care',
  'auto care': 'Transportation: Auto Insurance & Care',
  'debt service: vehicle financing (acura rdx)': 'Debt Service: Vehicle Financing (Acura RDX)',
  'vehicle financing': 'Debt Service: Vehicle Financing (Acura RDX)',
  'auto loan': 'Debt Service: Vehicle Financing (Acura RDX)',

  // Entertainment & Tech
  'entertainment: streaming & media': 'Entertainment: Streaming & Media',
  'streaming': 'Entertainment: Streaming & Media',
  'entertainment: hobbies & recreation': 'Entertainment: Hobbies & Recreation',
  'entertainment & hobbies': 'Entertainment: Hobbies & Recreation',
  'recreation': 'Entertainment: Hobbies & Recreation',
  'hobbies': 'Entertainment: Hobbies & Recreation',
  'gaming': 'Entertainment: Hobbies & Recreation',
  'technology: software & subscriptions': 'Technology: Software & Subscriptions',
  'software': 'Technology: Software & Subscriptions',
  'subscriptions': 'Technology: Software & Subscriptions',
  'cloud storage': 'Technology: Software & Subscriptions',

  // Pets & Personal Care & Shopping
  'pets & pet care (riley)': 'Pets & Pet Care (Riley)',
  'pet: riley': 'Pets & Pet Care (Riley)',
  'pets': 'Pets & Pet Care (Riley)',
  'pet care': 'Pets & Pet Care (Riley)',
  'shopping: general retail & household': 'Shopping: General Retail & Household',
  'shopping': 'Shopping: General Retail & Household',
  'retail': 'Shopping: General Retail & Household',
  'shopping: clothing & apparel': 'Shopping: Clothing & Apparel',
  'clothing': 'Shopping: Clothing & Apparel',
  'apparel': 'Shopping: Clothing & Apparel',
  'shopping: electronics & technology': 'Shopping: Electronics & Technology',
  'electronics': 'Shopping: Electronics & Technology',
  'personal care & fitness': 'Personal Care & Fitness',
  'personal care': 'Personal Care & Fitness',
  'fitness': 'Personal Care & Fitness',
  'travel, lodging & vacation': 'Travel, Lodging & Vacation',
  'travel': 'Travel, Lodging & Vacation',
  'lodging': 'Travel, Lodging & Vacation',
  'legal, professional & taxes': 'Legal, Professional & Taxes',
  'legal & taxes': 'Legal, Professional & Taxes',
  'taxes': 'Legal, Professional & Taxes',

  // Transfers & Banking
  'transfer: internal liquidity': 'Transfer: Internal Liquidity',
  'transfer: internal': 'Transfer: Internal Liquidity',
  'credit card payment': 'Transfer: Internal Liquidity',
  'internal transfer': 'Transfer: Internal Liquidity',
  'transfer: interspousal (laura pelech)': 'Transfer: Interspousal (Laura Pelech)',
  'interspousal': 'Transfer: Interspousal (Laura Pelech)',
  'transfer: family reimbursement': 'Transfer: Family Reimbursement',
  'family reimbursement': 'Transfer: Family Reimbursement',
  'transfer: peer-to-peer & personal reimbursements': 'Transfer: Peer-to-Peer & Personal Reimbursements',
  'peer-to-peer': 'Transfer: Peer-to-Peer & Personal Reimbursements',
  'zelle incoming': 'Transfer: Peer-to-Peer & Personal Reimbursements',
  'zelle outgoing': 'Transfer: Peer-to-Peer & Personal Reimbursements',
  'venmo incoming': 'Transfer: Peer-to-Peer & Personal Reimbursements',
  'venmo outgoing': 'Transfer: Peer-to-Peer & Personal Reimbursements',
  'investment: brokerage & capital accumulation': 'Investment: Brokerage & Capital Accumulation',
  'brokerage': 'Investment: Brokerage & Capital Accumulation',
  'investment': 'Investment: Brokerage & Capital Accumulation',

  // Income
  'income: payroll': 'Income: Payroll',
  'income-payroll': 'Income: Payroll',
  'payroll': 'Income: Payroll',
  'income: interest & passive': 'Income: Interest & Passive',
  'income: interest': 'Income: Interest & Passive',
  'interest': 'Income: Interest & Passive',
  'income: health / hsa reimbursement': 'Income: Health / HSA Reimbursement',
  'hsa reimbursement': 'Income: Health / HSA Reimbursement',
  'general & miscellaneous': 'General & Miscellaneous',
  'unknown': 'General & Miscellaneous',
  'uncategorized': 'General & Miscellaneous',
};

export function canonicalizeCategory(rawCategory?: string | null): CanonicalCategory {
  if (!rawCategory || !rawCategory.trim()) return 'General & Miscellaneous';
  const trimmed = rawCategory.trim();
  const lower = trimmed.toLowerCase();

  if (CATEGORY_NORMALIZATION_MAP[lower]) {
    return CATEGORY_NORMALIZATION_MAP[lower];
  }

  // Exact match against canonical list case-insensitively
  for (const canonical of CANONICAL_CATEGORIES) {
    if (canonical.toLowerCase() === lower) {
      return canonical;
    }
  }

  return 'General & Miscellaneous';
}

export function testPattern(pattern: string | null | undefined, text: string): boolean {
  if (!pattern || !text) return false;
  const trimmed = pattern.trim();
  if (!trimmed) return false;

  // Regex format /pattern/flags
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const lastSlash = trimmed.lastIndexOf('/');
    const patternBody = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1);
    try {
      const regex = new RegExp(patternBody, flags || 'i');
      return regex.test(text);
    } catch {
      return text.toUpperCase().includes(patternBody.toUpperCase());
    }
  }

  // Regex metacharacters
  if (/[.*+?^${}()|[\]\\]/.test(trimmed)) {
    try {
      const regex = new RegExp(trimmed, 'i');
      return regex.test(text);
    } catch {
      // Fallback
    }
  }

  return text.toUpperCase().includes(trimmed.toUpperCase());
}

export const DEFAULT_RULES: Rule[] = [
  // 1. Utilities
  { pattern: 'COMED', rawPattern: 'COMED|COMMONWEALTH EDISON', cleanPattern: 'ComEd', matchField: 'dual', targetMerchant: 'ComEd', targetCategory: 'Utilities: Electric', priority: 10 },
  { pattern: 'NICOR GAS', rawPattern: 'NICOR GAS|NICOR', cleanPattern: 'Nicor Gas', matchField: 'dual', targetMerchant: 'Nicor Gas', targetCategory: 'Utilities: Gas', priority: 10 },
  { pattern: 'COMCAST', rawPattern: 'COMCAST|XFINITY', cleanPattern: 'Comcast / Xfinity', matchField: 'dual', targetMerchant: 'Comcast / Xfinity', targetCategory: 'Utilities: Internet & Cable', priority: 10 },
  { pattern: 'VERIZON', rawPattern: 'VERIZON|VZWRLSS', cleanPattern: 'Verizon Wireless', matchField: 'dual', targetMerchant: 'Verizon Wireless', targetCategory: 'Utilities: Cell Phone', priority: 10 },
  { pattern: 'AT&T', rawPattern: 'AT&T|ATT\\*', cleanPattern: 'AT&T', matchField: 'dual', targetMerchant: 'AT&T', targetCategory: 'Utilities: Cell Phone', priority: 10 },
  { pattern: 'T-MOBILE', rawPattern: 'T-MOBILE|TMOBILE', cleanPattern: 'T-Mobile', matchField: 'dual', targetMerchant: 'T-Mobile', targetCategory: 'Utilities: Cell Phone', priority: 10 },
  { pattern: 'WASTE MGMT', rawPattern: 'WASTE MGMT|WASTE MANAGEMENT', cleanPattern: 'Waste Management', matchField: 'dual', targetMerchant: 'Waste Management', targetCategory: 'Utilities: Water & Waste', priority: 10 },
  { pattern: 'VILLAGE WATER', rawPattern: 'VOSCHAUMBURG|VILLAGE OF.*WATER|WATER BILL', cleanPattern: 'Village Water', matchField: 'dual', targetCategory: 'Utilities: Water & Waste', priority: 10 },

  // 2. Groceries & Supermarkets
  { pattern: 'TRADER JOES', rawPattern: 'TRADER JOE|TRADER JOES', cleanPattern: "Trader Joe's", matchField: 'dual', targetMerchant: "Trader Joe's", targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'JEWEL OSCO', rawPattern: 'JEWEL OSCO|JEWEL-OSCO', cleanPattern: 'Jewel-Osco', matchField: 'dual', targetMerchant: 'Jewel-Osco', targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'ALDI', rawPattern: 'ALDI', cleanPattern: 'ALDI', matchField: 'dual', targetMerchant: 'ALDI', targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'MARIANO', rawPattern: 'MARIANO', cleanPattern: "Mariano's", matchField: 'dual', targetMerchant: "Mariano's", targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'WHOLE FOODS', rawPattern: 'WHOLE FOODS|WHOLEFDS', cleanPattern: 'Whole Foods Market', matchField: 'dual', targetMerchant: 'Whole Foods Market', targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'MEIJER', rawPattern: 'MEIJER', cleanPattern: 'Meijer', matchField: 'dual', targetMerchant: 'Meijer', targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'TONYS FRESH', rawPattern: "TONYS FRESH|TONY'S FRESH", cleanPattern: "Tony's Fresh Market", matchField: 'dual', targetMerchant: "Tony's Fresh Market", targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'BINNY', rawPattern: "BINNY'S|BINNYS", cleanPattern: "Binny's Beverage Depot", matchField: 'dual', targetMerchant: "Binny's Beverage Depot", targetCategory: 'Groceries & Supermarket', priority: 20 },
  { pattern: 'COSTCO', rawPattern: 'COSTCO', cleanPattern: 'Costco Wholesale', matchField: 'dual', targetMerchant: 'Costco Wholesale', targetCategory: 'Groceries & Supermarket', priority: 20 },

  // 3. Dining Out: Fast Food & Coffee
  { pattern: 'STARBUCKS', rawPattern: 'STARBUCKS', cleanPattern: 'Starbucks Coffee', matchField: 'dual', targetMerchant: 'Starbucks Coffee', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'DUNKIN', rawPattern: 'DUNKIN', cleanPattern: 'Dunkin', matchField: 'dual', targetMerchant: 'Dunkin', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'MCDONALD', rawPattern: "MCDONALD|MCDONALD'S", cleanPattern: "McDonald's", matchField: 'dual', targetMerchant: "McDonald's", targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'CHIPOTLE', rawPattern: 'CHIPOTLE', cleanPattern: 'Chipotle Mexican Grill', matchField: 'dual', targetMerchant: 'Chipotle Mexican Grill', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'TACO BELL', rawPattern: 'TACO BELL', cleanPattern: 'Taco Bell', matchField: 'dual', targetMerchant: 'Taco Bell', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'SUBWAY', rawPattern: 'SUBWAY', cleanPattern: 'Subway', matchField: 'dual', targetMerchant: 'Subway', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'BURGER KING', rawPattern: 'BURGER KING', cleanPattern: 'Burger King', matchField: 'dual', targetMerchant: 'Burger King', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'PORTILLOS', rawPattern: "PORTILLO|PORTILLO'S", cleanPattern: "Portillo's", matchField: 'dual', targetMerchant: "Portillo's", targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'JIMMY JOHNS', rawPattern: "JIMMY JOHN|JIMMY JOHN'S", cleanPattern: "Jimmy John's", matchField: 'dual', targetMerchant: "Jimmy John's", targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'CHICK FIL A', rawPattern: 'CHICK-FIL-A|CHICK FIL A', cleanPattern: 'Chick-fil-A', matchField: 'dual', targetMerchant: 'Chick-fil-A', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'CULVERS', rawPattern: "CULVER|CULVER'S", cleanPattern: "Culver's", matchField: 'dual', targetMerchant: "Culver's", targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'PANDA EXPRESS', rawPattern: 'PANDA EXPRESS', cleanPattern: 'Panda Express', matchField: 'dual', targetMerchant: 'Panda Express', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'DAIRY QUEEN', rawPattern: 'DAIRY QUEEN', cleanPattern: 'Dairy Queen', matchField: 'dual', targetMerchant: 'Dairy Queen', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },
  { pattern: 'GREAT AMERICAN BAGEL', rawPattern: 'GREAT AMERICAN BAGEL', cleanPattern: 'The Great American Bagel', matchField: 'dual', targetMerchant: 'The Great American Bagel', targetCategory: 'Dining Out: Fast Food & Coffee', priority: 25 },

  // 4. Dining Out: Workplace Meals
  { pattern: 'ARAMARK', rawPattern: 'ARAMARK|ARAMARK NORTHROP', cleanPattern: 'Aramark Cafeteria', matchField: 'dual', targetMerchant: 'Aramark Cafeteria', targetCategory: 'Dining Out: Workplace Meals', priority: 5 },
  { pattern: 'MARKET AT WORK', rawPattern: 'MARKET@WORK', cleanPattern: 'Market@Work', matchField: 'dual', targetMerchant: 'Market@Work', targetCategory: 'Dining Out: Workplace Meals', priority: 5 },
  { pattern: 'AMK MCMASTER', rawPattern: 'AMK MCMASTER|AMK MCMASTER-CARR', cleanPattern: 'AMK McMaster-Carr Cafeteria', matchField: 'dual', targetCategory: 'Dining Out: Workplace Meals', priority: 5 },

  // 5. Dining Out: Restaurants & Takeout
  { pattern: 'DOORDASH', rawPattern: 'DOORDASH', cleanPattern: 'DoorDash', matchField: 'dual', targetMerchant: 'DoorDash', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'UBER EATS', rawPattern: 'UBER EATS|UBEREATS', cleanPattern: 'Uber Eats', matchField: 'dual', targetMerchant: 'Uber Eats', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'GRUBHUB', rawPattern: 'GRUBHUB', cleanPattern: 'Grubhub', matchField: 'dual', targetMerchant: 'Grubhub', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'LOU MALNATIS', rawPattern: "LOU MALNATI|LOU MALNATI'S", cleanPattern: "Lou Malnati's Pizzeria", matchField: 'dual', targetMerchant: "Lou Malnati's Pizzeria", targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'GIORDANOS', rawPattern: "GIORDANO|GIORDANO'S", cleanPattern: "Giordano's", matchField: 'dual', targetMerchant: "Giordano's", targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'ROSATIS', rawPattern: "ROSATI|ROSATI'S", cleanPattern: "Rosati's Pizza", matchField: 'dual', targetMerchant: "Rosati's Pizza", targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'DAN THAI', rawPattern: 'DAN THAI|DANTHAIFOOD', cleanPattern: 'Dan Thai Restaurant', matchField: 'dual', targetMerchant: 'Dan Thai Restaurant', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'PITA BBQ', rawPattern: 'PITA BBQ', cleanPattern: 'Pita BBQ', matchField: 'dual', targetMerchant: 'Pita BBQ', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'OISHI SUSHI', rawPattern: 'OISHI SUSHI', cleanPattern: 'Oishi Sushi', matchField: 'dual', targetMerchant: 'Oishi Sushi', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'BRUNCH CAFE', rawPattern: 'BRUNCH CAFE|BRUNCHCAFE', cleanPattern: 'Brunch Cafe', matchField: 'dual', targetMerchant: 'Brunch Cafe', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },
  { pattern: 'WING SNOB', rawPattern: 'WING SNOB', cleanPattern: 'Wing Snob', matchField: 'dual', targetMerchant: 'Wing Snob', targetCategory: 'Dining Out: Restaurants & Takeout', priority: 25 },

  // 6. Education & Childcare
  { pattern: 'GODDARD SCHOOL', rawPattern: 'GODDARD SCHO|THE GODDARD SCHOOL', cleanPattern: 'The Goddard School', matchField: 'dual', targetMerchant: 'The Goddard School', targetCategory: 'Education & Childcare (Goddard School)', priority: 10 },
  { pattern: 'TUTOR TIME', rawPattern: 'TUTOR TIME', cleanPattern: 'Tutor Time', matchField: 'dual', targetCategory: 'Education & Childcare (Goddard School)', priority: 10 },

  // 7. Medical & Healthcare
  { pattern: 'SCHWARTZ PEDIATRICS', rawPattern: 'SCHWARTZ PEDIATRICS', cleanPattern: 'Schwartz Pediatrics', matchField: 'dual', targetMerchant: 'Schwartz Pediatrics', targetCategory: 'Medical & Healthcare', priority: 15 },
  { pattern: 'SCHAUMBURG DENTAL', rawPattern: 'SCHAUMBURG DENTAL', cleanPattern: 'Schaumburg Dental Studio', matchField: 'dual', targetMerchant: 'Schaumburg Dental Studio', targetCategory: 'Medical & Healthcare', priority: 15 },
  { pattern: 'NORTHWEST COMMUNITY', rawPattern: 'NORTHWEST COMMUNITY|NCH-MY CHART|NCH MYCHART', cleanPattern: 'Northwest Community Healthcare', matchField: 'dual', targetMerchant: 'Northwest Community Healthcare', targetCategory: 'Medical & Healthcare', priority: 15 },
  { pattern: 'CVS', rawPattern: 'CVS|CVS/PHARM', cleanPattern: 'CVS Pharmacy', matchField: 'dual', targetMerchant: 'CVS Pharmacy', targetCategory: 'Medical & Healthcare', priority: 20 },
  { pattern: 'WALGREENS', rawPattern: 'WALGREENS', cleanPattern: 'Walgreens', matchField: 'dual', targetMerchant: 'Walgreens', targetCategory: 'Medical & Healthcare', priority: 20 },

  // 8. Transportation
  { pattern: 'SHELL OIL', rawPattern: 'SHELL OIL|SHELL', cleanPattern: 'Shell', matchField: 'dual', targetMerchant: 'Shell', targetCategory: 'Transportation: Gasoline & Fuel', priority: 20 },
  { pattern: 'BP GAS', rawPattern: 'BP |BP#', cleanPattern: 'BP', matchField: 'dual', targetMerchant: 'BP', targetCategory: 'Transportation: Gasoline & Fuel', priority: 20 },
  { pattern: 'EXXONMOBIL', rawPattern: 'EXXON|MOBIL', cleanPattern: 'ExxonMobil', matchField: 'dual', targetMerchant: 'ExxonMobil', targetCategory: 'Transportation: Gasoline & Fuel', priority: 20 },
  { pattern: 'SPEEDWAY', rawPattern: 'SPEEDWAY', cleanPattern: 'Speedway', matchField: 'dual', targetMerchant: 'Speedway', targetCategory: 'Transportation: Gasoline & Fuel', priority: 20 },
  { pattern: 'THORNTONS', rawPattern: 'THORNTONS', cleanPattern: 'Thorntons', matchField: 'dual', targetMerchant: 'Thorntons', targetCategory: 'Transportation: Gasoline & Fuel', priority: 20 },
  { pattern: 'ILLINOIS TOLLWAY', rawPattern: 'ILLINOIS TOLLWAY|IPASS', cleanPattern: 'Illinois Tollway (I-PASS)', matchField: 'dual', targetMerchant: 'Illinois Tollway (I-PASS)', targetCategory: 'Transportation: Tolls & Transit', priority: 15 },
  { pattern: 'UBER TRIP', rawPattern: 'UBER TRIP|UBER\\*|UBER PASS', cleanPattern: 'Uber', matchField: 'dual', targetMerchant: 'Uber', targetCategory: 'Transportation: Tolls & Transit', priority: 25 },
  { pattern: 'LYFT', rawPattern: 'LYFT', cleanPattern: 'Lyft', matchField: 'dual', targetMerchant: 'Lyft', targetCategory: 'Transportation: Tolls & Transit', priority: 25 },
  { pattern: 'VENTRA', rawPattern: 'VENTRA', cleanPattern: 'Ventra Chicago', matchField: 'dual', targetCategory: 'Transportation: Tolls & Transit', priority: 25 },
  { pattern: 'AUTOZONE', rawPattern: 'AUTOZONE', cleanPattern: 'AutoZone', matchField: 'dual', targetMerchant: 'AutoZone', targetCategory: 'Transportation: Auto Insurance & Care', priority: 25 },
  { pattern: 'GEICO', rawPattern: 'GEICO', cleanPattern: 'GEICO', matchField: 'dual', targetMerchant: 'GEICO', targetCategory: 'Transportation: Auto Insurance & Care', priority: 10 },
  { pattern: 'STATE FARM', rawPattern: 'STATE FARM', cleanPattern: 'State Farm', matchField: 'dual', targetMerchant: 'State Farm', targetCategory: 'Transportation: Auto Insurance & Care', priority: 10 },
  { pattern: 'PROGRESSIVE', rawPattern: 'PROGRESSIVE', cleanPattern: 'Progressive', matchField: 'dual', targetMerchant: 'Progressive', targetCategory: 'Transportation: Auto Insurance & Care', priority: 10 },
  { pattern: 'HONDA FINANCIAL', rawPattern: 'HONDA FINANCIAL|AMERICAN HONDA', cleanPattern: 'American Honda Finance', matchField: 'dual', targetCategory: 'Debt Service: Vehicle Financing (Acura RDX)', priority: 10 },

  // 9. Housing
  { pattern: 'CHASE MORTGAGE', rawPattern: 'CHASE MORTGAGE|HOME LENDING', cleanPattern: 'Chase Mortgage', matchField: 'dual', targetCategory: 'Housing: Mortgage Principal & Interest', priority: 10 },
  { pattern: 'COOK COUNTY TAX', rawPattern: 'COOK COUNTY|PROPERTYTX|PROPERTY TAX|COUNTY TREASURER', cleanPattern: 'Cook County Property Tax', matchField: 'dual', targetCategory: 'Housing: Real Estate Taxes', priority: 10 },
  { pattern: 'HOME DEPOT', rawPattern: 'HOME DEPOT|HOMEDEPOT', cleanPattern: 'The Home Depot', matchField: 'dual', targetMerchant: 'The Home Depot', targetCategory: 'Housing: Home Maintenance & Improvement', priority: 20 },
  { pattern: 'LOWES', rawPattern: "LOWES|LOWE'S", cleanPattern: "Lowe's", matchField: 'dual', targetMerchant: "Lowe's", targetCategory: 'Housing: Home Maintenance & Improvement', priority: 20 },
  { pattern: 'MENARDS', rawPattern: 'MENARDS', cleanPattern: 'Menards', matchField: 'dual', targetMerchant: 'Menards', targetCategory: 'Housing: Home Maintenance & Improvement', priority: 20 },
  { pattern: 'ACE HARDWARE', rawPattern: 'ACE HARDWARE', cleanPattern: 'Ace Hardware', matchField: 'dual', targetMerchant: 'Ace Hardware', targetCategory: 'Housing: Home Maintenance & Improvement', priority: 20 },
  { pattern: 'HARBOR FREIGHT', rawPattern: 'HARBOR FREIGHT', cleanPattern: 'Harbor Freight Tools', matchField: 'dual', targetMerchant: 'Harbor Freight Tools', targetCategory: 'Housing: Home Maintenance & Improvement', priority: 20 },
  { pattern: 'IKEA', rawPattern: 'IKEA', cleanPattern: 'IKEA', matchField: 'dual', targetMerchant: 'IKEA', targetCategory: 'Housing: Home Furnishings', priority: 20 },
  { pattern: 'WAYFAIR', rawPattern: 'WAYFAIR', cleanPattern: 'Wayfair', matchField: 'dual', targetMerchant: 'Wayfair', targetCategory: 'Housing: Home Furnishings', priority: 20 },

  // 10. Entertainment, Media & Hobbies
  { pattern: 'NETFLIX', rawPattern: 'NETFLIX', cleanPattern: 'Netflix', matchField: 'dual', targetMerchant: 'Netflix', targetCategory: 'Entertainment: Streaming & Media', priority: 25 },
  { pattern: 'SPOTIFY', rawPattern: 'SPOTIFY', cleanPattern: 'Spotify', matchField: 'dual', targetMerchant: 'Spotify', targetCategory: 'Entertainment: Streaming & Media', priority: 25 },
  { pattern: 'HULU', rawPattern: 'HULU', cleanPattern: 'Hulu', matchField: 'dual', targetMerchant: 'Hulu', targetCategory: 'Entertainment: Streaming & Media', priority: 25 },
  { pattern: 'DISNEY PLUS', rawPattern: 'DISNEY PLUS|DISNEY\\*', cleanPattern: 'Disney+', matchField: 'dual', targetMerchant: 'Disney+', targetCategory: 'Entertainment: Streaming & Media', priority: 25 },
  { pattern: 'HBO MAX', rawPattern: 'HBO|MAX\\.COM', cleanPattern: 'Max / HBO', matchField: 'dual', targetMerchant: 'Max / HBO', targetCategory: 'Entertainment: Streaming & Media', priority: 25 },
  { pattern: 'YOUTUBE', rawPattern: 'YOUTUBE', cleanPattern: 'YouTube Premium', matchField: 'dual', targetMerchant: 'YouTube Premium', targetCategory: 'Entertainment: Streaming & Media', priority: 25 },
  { pattern: 'STEAM GAMES', rawPattern: 'STEAMGAMES|VALVE', cleanPattern: 'Steam / Valve', matchField: 'dual', targetMerchant: 'Steam / Valve', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 25 },
  { pattern: 'XBOX', rawPattern: 'XBOX|MICROSOFT\\*XBOX', cleanPattern: 'Microsoft Xbox', matchField: 'dual', targetMerchant: 'Microsoft Xbox', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 25 },
  { pattern: 'NINTENDO', rawPattern: 'NINTENDO', cleanPattern: 'Nintendo', matchField: 'dual', targetMerchant: 'Nintendo', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 25 },
  { pattern: 'NEWSDEMON', rawPattern: 'NEWSDEMON', cleanPattern: 'NewsDemon', matchField: 'dual', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 20 },
  { pattern: 'THECUBENET', rawPattern: 'THECUBENET', cleanPattern: 'TheCubeNet', matchField: 'dual', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 20 },
  { pattern: 'DRUNKENSLUG', rawPattern: 'DRUNKENSLUG', cleanPattern: 'DrunkenSlug', matchField: 'dual', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 20 },
  { pattern: 'PATREON', rawPattern: 'PATREON', cleanPattern: 'Patreon', matchField: 'dual', targetCategory: 'Entertainment: Hobbies & Recreation', priority: 25 },

  // 11. Technology & Software
  { pattern: 'GOOGLE ONE', rawPattern: 'GOOGLE ONE|GOOGLE \\*GOOGLE ONE', cleanPattern: 'Google One', matchField: 'dual', targetMerchant: 'Google One', targetCategory: 'Technology: Software & Subscriptions', priority: 15 },
  { pattern: 'ICLOUD', rawPattern: 'ICLOUD', cleanPattern: 'Apple iCloud', matchField: 'dual', targetCategory: 'Technology: Software & Subscriptions', priority: 15 },
  { pattern: 'GITHUB', rawPattern: 'GITHUB', cleanPattern: 'GitHub', matchField: 'dual', targetMerchant: 'GitHub', targetCategory: 'Technology: Software & Subscriptions', priority: 15 },
  { pattern: 'OPENAI', rawPattern: 'OPENAI|CHATGPT', cleanPattern: 'OpenAI', matchField: 'dual', targetCategory: 'Technology: Software & Subscriptions', priority: 15 },

  // 12. Pets
  { pattern: 'PETCO', rawPattern: 'PETCO', cleanPattern: 'Petco', matchField: 'dual', targetMerchant: 'Petco', targetCategory: 'Pets & Pet Care (Riley)', priority: 15 },
  { pattern: 'PETSMART', rawPattern: 'PETSMART', cleanPattern: 'PetSmart', matchField: 'dual', targetMerchant: 'PetSmart', targetCategory: 'Pets & Pet Care (Riley)', priority: 15 },
  { pattern: 'CHEWY', rawPattern: 'CHEWY|CHEWY\\.COM', cleanPattern: 'Chewy.com', matchField: 'dual', targetMerchant: 'Chewy.com', targetCategory: 'Pets & Pet Care (Riley)', priority: 15 },
  { pattern: 'GOLF ROSE', rawPattern: 'GOLF ROSE ANIMAL HOSPITAL', cleanPattern: 'Golf Rose Animal Hospital', matchField: 'dual', targetCategory: 'Pets & Pet Care (Riley)', priority: 15 },
  { pattern: 'YUPPIE PUPPIE', rawPattern: 'THE YUPPIE PUPPIE', cleanPattern: 'The Yuppie Puppie', matchField: 'dual', targetCategory: 'Pets & Pet Care (Riley)', priority: 15 },
  { pattern: 'COMB AND COLLAR', rawPattern: 'COMB & COLLAR|COMB AND COLLAR', cleanPattern: 'Comb & Collar Club', matchField: 'dual', targetCategory: 'Pets & Pet Care (Riley)', priority: 15 },

  // 13. Shopping: General, Clothing, Tech
  { pattern: 'AMAZON', rawPattern: 'AMAZON|AMZN', cleanPattern: 'Amazon', matchField: 'dual', targetMerchant: 'Amazon', targetCategory: 'Shopping: General Retail & Household', priority: 30 },
  { pattern: 'TARGET', rawPattern: 'TARGET', cleanPattern: 'Target', matchField: 'dual', targetMerchant: 'Target', targetCategory: 'Shopping: General Retail & Household', priority: 30 },
  { pattern: 'WALMART', rawPattern: 'WALMART', cleanPattern: 'Walmart', matchField: 'dual', targetMerchant: 'Walmart', targetCategory: 'Shopping: General Retail & Household', priority: 30 },
  { pattern: 'ZAPPOS', rawPattern: 'ZAPPOS', cleanPattern: 'Zappos.com', matchField: 'dual', targetMerchant: 'Zappos.com', targetCategory: 'Shopping: Clothing & Apparel', priority: 30 },
  { pattern: 'MACYS', rawPattern: "MACYS|MACY'S", cleanPattern: "Macy's", matchField: 'dual', targetMerchant: "Macy's", targetCategory: 'Shopping: Clothing & Apparel', priority: 30 },
  { pattern: 'NORDSTROM', rawPattern: 'NORDSTROM', cleanPattern: 'Nordstrom', matchField: 'dual', targetMerchant: 'Nordstrom', targetCategory: 'Shopping: Clothing & Apparel', priority: 30 },
  { pattern: 'BEST BUY', rawPattern: 'BEST BUY|BESTBUY', cleanPattern: 'Best Buy', matchField: 'dual', targetMerchant: 'Best Buy', targetCategory: 'Shopping: Electronics & Technology', priority: 30 },
  { pattern: 'MICRO CENTER', rawPattern: 'MICRO CENTER', cleanPattern: 'Micro Center', matchField: 'dual', targetMerchant: 'Micro Center', targetCategory: 'Shopping: Electronics & Technology', priority: 30 },
  { pattern: 'APPLE STORE', rawPattern: 'APPLE STORE|APPLE\\.COM', cleanPattern: 'Apple', matchField: 'dual', targetMerchant: 'Apple', targetCategory: 'Shopping: Electronics & Technology', priority: 30 },

  // 14. Personal Care & Fitness
  { pattern: 'HAIR SOCIETY', rawPattern: 'S&T HAIR SOCIETY', cleanPattern: 'S&T Hair Society', matchField: 'dual', targetMerchant: 'S&T Hair Society', targetCategory: 'Personal Care & Fitness', priority: 25 },
  { pattern: 'INNOV8 HAIR', rawPattern: 'INNOV8 HAIR', cleanPattern: 'Innov8 Hair', matchField: 'dual', targetMerchant: 'Innov8 Hair', targetCategory: 'Personal Care & Fitness', priority: 25 },
  { pattern: 'CRUNCH FITNESS', rawPattern: 'CRUNCH FITNESS|CRUNCH FIT', cleanPattern: 'Crunch Fitness', matchField: 'dual', targetMerchant: 'Crunch Fitness', targetCategory: 'Personal Care & Fitness', priority: 25 },

  // 15. Legal & Taxes
  { pattern: 'IRS', rawPattern: 'IRS TREAS|IRS USATAXPYMT', cleanPattern: 'IRS', matchField: 'dual', targetCategory: 'Legal, Professional & Taxes', priority: 10 },
  { pattern: 'IL DEPT REV', rawPattern: 'IL DEPT REV|ILLINOIS DEPT REV', cleanPattern: 'Illinois Department of Revenue', matchField: 'dual', targetCategory: 'Legal, Professional & Taxes', priority: 10 },
  { pattern: 'TURBOTAX', rawPattern: 'TURBOTAX|FREETAXUSA', cleanPattern: 'Tax Filing', matchField: 'dual', targetCategory: 'Legal, Professional & Taxes', priority: 10 },

  // 16. Transfers & Banking
  { pattern: 'CHASE AUTOPAY', rawPattern: 'AUTOMATIC PAYMENT - THANK YOU|CHASE CREDIT CRD AUTOPAY', cleanPattern: 'Chase Credit Card Payment', matchField: 'dual', targetMerchant: 'Chase Credit Card Payment', targetCategory: 'Transfer: Internal Liquidity', priority: 5 },
  { pattern: 'ATM WITHDRAWAL', rawPattern: 'ATM WITHDRAWAL|ATM CASH WITHDRAWAL|ATM FEE', cleanPattern: 'ATM Cash Withdrawal', matchField: 'dual', targetCategory: 'Transfer: Internal Liquidity', priority: 5 },
  { pattern: 'INTEREST PAID', rawPattern: '^INTEREST PAID|INTEREST PAYMENT', cleanPattern: 'Bank Interest', matchField: 'dual', targetMerchant: 'Bank Interest', targetCategory: 'Income: Interest & Passive', priority: 5 },
  { pattern: 'LAURA PELECH', rawPattern: 'LAURA PELECH', cleanPattern: 'Laura Pelech', matchField: 'dual', targetMerchant: 'Laura Pelech', targetCategory: 'Transfer: Interspousal (Laura Pelech)', priority: 3 },
  { pattern: 'PELECH FAMILY', rawPattern: 'NEIL J PELECH|KENNETH PELECH|MARK PELECH', matchField: 'dual', targetCategory: 'Transfer: Family Reimbursement', priority: 4 },
  { pattern: 'SCHWAB', rawPattern: 'SCHWAB BROKERAGE|CHARLES SCHWAB', cleanPattern: 'Charles Schwab Brokerage', matchField: 'dual', targetMerchant: 'Charles Schwab Brokerage', targetCategory: 'Investment: Brokerage & Capital Accumulation', priority: 5 },

  // 17. Income
  { pattern: 'NORTHROP GRUMMAN', rawPattern: 'NORTHROP GRUMMAN|NG DIR DEP', cleanPattern: 'Northrop Grumman Direct Deposit', matchField: 'dual', targetMerchant: 'Northrop Grumman', targetCategory: 'Income: Payroll', priority: 5 },
  { pattern: 'MCMASTER PAYROLL', rawPattern: 'MCMASTER.*PAYROLL|MCMASTER.*DIR DEP|McMaster-Carr Paystub', cleanPattern: 'McMaster-Carr Paystub Direct Deposit', matchField: 'dual', targetMerchant: 'McMaster-Carr Supply Company', targetCategory: 'Income: Payroll', priority: 5 },
];

export function evaluateRule(
  rawDescription: string,
  cleanName: string | null | undefined,
  ruleList: Rule[] = DEFAULT_RULES,
  amount?: number
): RuleMatchResult {
  const rawText = (rawDescription || '').trim();
  const cleanText = (cleanName || '').trim();

  // Sort rules by priority (ascending: lower priority value executes first)
  const sortedRules = [...ruleList].sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  for (const rule of sortedRules) {
    if (rule.isActive === false || rule.isActive === 0) continue;

    let isMatch = false;
    const matchField = rule.matchField || 'dual';

    if (matchField === 'raw_description') {
      const pat = rule.rawPattern || rule.pattern;
      isMatch = testPattern(pat, rawText);
    } else if (matchField === 'clean_name') {
      const pat = rule.cleanPattern || rule.pattern;
      isMatch = testPattern(pat, cleanText);
    } else if (matchField === 'dual') {
      const rawPat = rule.rawPattern || rule.pattern;
      if (rawPat && testPattern(rawPat, rawText)) {
        isMatch = true;
      } else if (rule.cleanPattern && testPattern(rule.cleanPattern, cleanText)) {
        isMatch = true;
      }
    }

    if (isMatch) {
      return {
        matched: true,
        ruleId: rule.id,
        vendor: rule.targetMerchant,
        category: canonicalizeCategory(rule.targetCategory),
        tags: rule.targetTags || [],
        confidence: 1.0,
      };
    }
  }

  // Fallback Heuristics
  const upper = `${rawText} ${cleanText}`.toUpperCase();

  // Interspousal
  if (upper.includes('LAURA PELECH')) {
    return { matched: true, category: 'Transfer: Interspousal (Laura Pelech)', confidence: 0.98 };
  }

  // Family reimbursement
  if (/(NEIL J PELECH|KENNETH PELECH|MARK PELECH)/i.test(upper)) {
    return { matched: true, category: 'Transfer: Family Reimbursement', confidence: 0.98 };
  }

  // Zelle / Venmo general P2P
  if (/ZELLE|QUICKPAY|VENMO/i.test(upper)) {
    return { matched: true, category: 'Transfer: Peer-to-Peer & Personal Reimbursements', confidence: 0.95 };
  }

  // CC Payment / Internal Transfer
  if (/(CREDIT CRD AUTOPAY|AUTOMATIC PAYMENT|INTERNAL TRANSFER|ONLINE PAYMENT)/i.test(upper)) {
    return { matched: true, category: 'Transfer: Internal Liquidity', confidence: 0.95 };
  }

  return { matched: false };
}
