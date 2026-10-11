export interface NormalizedMerchant {
  cleanName: string;
  websiteUrl?: string;
}

interface KnownMerchantRule {
  pattern: RegExp;
  cleanName: string;
  websiteUrl?: string;
}

const KNOWN_MERCHANT_RULES: KnownMerchantRule[] = [
  // Core Utilities & Telecommunications
  { pattern: /\bCOMED\b|\bCOMM\s*ED\b/i, cleanName: 'ComEd', websiteUrl: 'https://comed.com' },
  { pattern: /\bNICOR(\s*GAS)?\b/i, cleanName: 'Nicor Gas', websiteUrl: 'https://nicorgas.com' },
  { pattern: /\bCOMCAST\b|\bXFINITY\b/i, cleanName: 'Comcast / Xfinity', websiteUrl: 'https://xfinity.com' },
  { pattern: /\bVERIZON(\s+WRLS)?\b/i, cleanName: 'Verizon Wireless', websiteUrl: 'https://verizon.com' },
  { pattern: /\bAT&T\b|\bATT\b/i, cleanName: 'AT&T', websiteUrl: 'https://att.com' },
  { pattern: /\bT-MOBILE\b|\bTMOBILE\b/i, cleanName: 'T-Mobile', websiteUrl: 'https://t-mobile.com' },
  { pattern: /\bWASTE\s*MGMT\b|\bWASTE\s*MANAGEMENT\b/i, cleanName: 'Waste Management', websiteUrl: 'https://wm.com' },

  // Insurance
  { pattern: /\bGEICO\b/i, cleanName: 'GEICO', websiteUrl: 'https://geico.com' },
  { pattern: /\bSTATE\s+FARM\b/i, cleanName: 'State Farm', websiteUrl: 'https://statefarm.com' },
  { pattern: /\bALLSTATE\b/i, cleanName: 'Allstate', websiteUrl: 'https://allstate.com' },
  { pattern: /\bPROGRESSIVE\b/i, cleanName: 'Progressive', websiteUrl: 'https://progressive.com' },

  // Office & Business Supplies
  { pattern: /\bSTAPLES\b/i, cleanName: 'Staples', websiteUrl: 'https://staples.com' },
  { pattern: /\bOFFICE\s*DEPOT\b|\bOFFICEMAX\b/i, cleanName: 'Office Depot', websiteUrl: 'https://officedepot.com' },

  // Home & Hardware
  { pattern: /\bHOME\s*DEPOT\b/i, cleanName: 'The Home Depot', websiteUrl: 'https://homedepot.com' },
  { pattern: /\bLOWES\b|\bLOWE'?S\b/i, cleanName: "Lowe's", websiteUrl: 'https://lowes.com' },
  { pattern: /\bMENARDS\b/i, cleanName: 'Menards', websiteUrl: 'https://menards.com' },
  { pattern: /\bACE\s+HARDWARE\b/i, cleanName: 'Ace Hardware', websiteUrl: 'https://acehardware.com' },

  // Shopping & Tech
  { pattern: /\bAMAZON\b|\bAMZN\b/i, cleanName: 'Amazon', websiteUrl: 'https://amazon.com' },
  { pattern: /\bTARGET\b/i, cleanName: 'Target', websiteUrl: 'https://target.com' },
  { pattern: /\bWAL-?MART\b/i, cleanName: 'Walmart', websiteUrl: 'https://walmart.com' },
  { pattern: /\bCOSTCO\b/i, cleanName: 'Costco Wholesale', websiteUrl: 'https://costco.com' },
  { pattern: /\bBEST\s+BUY\b/i, cleanName: 'Best Buy', websiteUrl: 'https://bestbuy.com' },
  { pattern: /\bAPPLE(\.COM|\s+STORE)?\b/i, cleanName: 'Apple', websiteUrl: 'https://apple.com' },
  { pattern: /\bMICRO\s+CENTER\b/i, cleanName: 'Micro Center', websiteUrl: 'https://microcenter.com' },

  // Groceries & Supermarkets
  { pattern: /\bTRADER\s+JOE('?S)?\b/i, cleanName: "Trader Joe's", websiteUrl: 'https://traderjoes.com' },
  { pattern: /\bJEWEL(\s*OSCO)?\b/i, cleanName: 'Jewel-Osco', websiteUrl: 'https://jewelosco.com' },
  { pattern: /\bALDI\b/i, cleanName: 'ALDI', websiteUrl: 'https://aldi.us' },
  { pattern: /\bMARIANO('?S)?\b/i, cleanName: "Mariano's", websiteUrl: 'https://marianos.com' },
  { pattern: /\bWHOLE\s*F(OO)?DS(\s+MKT)?\b/i, cleanName: 'Whole Foods Market', websiteUrl: 'https://wholefoodsmarket.com' },

  // Dining & Coffee
  { pattern: /\bSTARBUCKS\b/i, cleanName: 'Starbucks Coffee', websiteUrl: 'https://starbucks.com' },
  { pattern: /\bDUNKIN\b/i, cleanName: 'Dunkin', websiteUrl: 'https://dunkindonuts.com' },
  { pattern: /\bMCDONALD('?S)?\b/i, cleanName: "McDonald's", websiteUrl: 'https://mcdonalds.com' },
  { pattern: /\bCHIPOTLE\b/i, cleanName: 'Chipotle Mexican Grill', websiteUrl: 'https://chipotle.com' },
  { pattern: /\bDOORDASH\b/i, cleanName: 'DoorDash', websiteUrl: 'https://doordash.com' },
  { pattern: /\bUBER\s*EATS\b/i, cleanName: 'Uber Eats', websiteUrl: 'https://ubereats.com' },
  { pattern: /\bPANERA(\s+BREAD)?\b/i, cleanName: 'Panera Bread', websiteUrl: 'https://panerabread.com' },
  { pattern: /\bBIG\s+BOWL\b/i, cleanName: 'Big Bowl' },
  { pattern: /\bCOMB\s*(&|\+|AND)\s*COLLAR\b/i, cleanName: 'Comb & Collar' },
  { pattern: /\bDRIFTWOOD\s+CAFE\b/i, cleanName: 'Driftwood Cafe' },

  // Gas, Transit & Tolls
  { pattern: /\bSHELL(\s+OIL)?\b/i, cleanName: 'Shell' },
  { pattern: /\bBP\b/i, cleanName: 'BP', websiteUrl: 'https://bp.com' },
  { pattern: /\bEXXON\b|\bEXXONMOBIL\b/i, cleanName: 'ExxonMobil', websiteUrl: 'https://exxon.com' },
  { pattern: /\bMOBIL\b/i, cleanName: 'Mobil', websiteUrl: 'https://mobil.com' },
  { pattern: /\bSPEEDWAY\b/i, cleanName: 'Speedway', websiteUrl: 'https://speedway.com' },
  { pattern: /\bTHORNTONS\b/i, cleanName: 'Thorntons', websiteUrl: 'https://mythorntons.com' },
  { pattern: /\bILLINOIS\s+TOLLWAY\b|\bIPASS\b/i, cleanName: 'Illinois Tollway (I-PASS)', websiteUrl: 'https://illinoistollway.com' },
  { pattern: /\bUBER(\s+TRIP)?\b/i, cleanName: 'Uber', websiteUrl: 'https://uber.com' },
  { pattern: /\bLYFT(\s*\*TRIP)?\b/i, cleanName: 'Lyft', websiteUrl: 'https://lyft.com' },

  // Streaming, Entertainment & Subscriptions
  { pattern: /\bNETFLIX(\.COM)?\b/i, cleanName: 'Netflix', websiteUrl: 'https://netflix.com' },
  { pattern: /\bSPOTIFY\b/i, cleanName: 'Spotify', websiteUrl: 'https://spotify.com' },
  { pattern: /\bHULU\b/i, cleanName: 'Hulu', websiteUrl: 'https://hulu.com' },
  { pattern: /\bDISNEY(\s*PLUS|\+)?\b/i, cleanName: 'Disney+', websiteUrl: 'https://disneyplus.com' },
  { pattern: /\bHBO\b|\bMAX\b/i, cleanName: 'Max / HBO', websiteUrl: 'https://max.com' },
  { pattern: /\bYOUTUBE(\s+PREMIUM)?\b/i, cleanName: 'YouTube Premium', websiteUrl: 'https://youtube.com' },

  // Pet Care
  { pattern: /\bPETCO\b/i, cleanName: 'Petco', websiteUrl: 'https://petco.com' },
  { pattern: /\bPETSMART\b/i, cleanName: 'PetSmart', websiteUrl: 'https://petsmart.com' },
  { pattern: /\bCHEWY(\.COM)?\b/i, cleanName: 'Chewy.com', websiteUrl: 'https://chewy.com' },

  // Financial Services & Payments
  { pattern: /\bPAYPAL\b/i, cleanName: 'PayPal', websiteUrl: 'https://paypal.com' },
  { pattern: /\bCHASE\s+CREDIT\s+CRD\b/i, cleanName: 'Chase Credit Card', websiteUrl: 'https://chase.com' },
];

function toTitleCase(str: string): string {
  const minorWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', '&']);
  return str
    .split(/\s+/)
    .map((word, index) => {
      if (word === '&') return '&';
      // Handle hyphenated words
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }
      const lower = word.toLowerCase();
      if (index > 0 && minorWords.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function normalizeMerchant(rawDescription: string): NormalizedMerchant {
  if (!rawDescription || !rawDescription.trim()) {
    return { cleanName: 'Unknown' };
  }

  const trimmed = rawDescription.trim();

  // 1. Check known merchant pattern rules against full raw description first
  for (const rule of KNOWN_MERCHANT_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        cleanName: rule.cleanName,
        ...(rule.websiteUrl ? { websiteUrl: rule.websiteUrl } : {}),
      };
    }
  }

  // 2. Strip clearinghouse prefixes
  let cleaned = trimmed.replace(
    /^(SQ\s*\*|TST\s*\*|PAR\s*\*|DD\s*\*|WL\s*\*|PP\s*\*|ACT\s*\*|PY\s*\*|TM\s*\*|SP\s*\*|SP\s+|AT\s*\*|AMZ\s*\*|CF\s*\*|CL\s*\*|LS\s*\*|LS\s+|PAYPAL\s*\*|POS\s+DEBIT\s*-?|POS\s+PURCHASE\s*-?|PURCHASE\s+AUTHORIZED\s+ON\s+\d{2}\/\d{2}|CHECKCARD\s*(\d{4}\s+)?|CHECK\s+CARD\s+PURCHASE\s*-?|RECURRING\s+PAYMENT|DEBIT\s+CARD\s+PURCHASE\s*-?|DEBIT\s+CARD\s*-?|CARD\s+PURCHASE\s+WITH\s+PIN\s+\d{2}\/\d{2}|&\s*)\s*/i,
    ''
  );

  // 3. Strip phone numbers
  cleaned = cleaned.replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, '');

  // 4. Strip bill payment phrases and reference numbers
  cleaned = cleaned.replace(/\s+(\d{4,}\s+)?BILL\s+PAYMENT\b.*$/i, '');

  // 5. Strip terminal IDs and store codes (#1234, T-1234, STORE 1234, WHSE #1234)
  cleaned = cleaned.replace(/\s+#\d+/g, '');
  cleaned = cleaned.replace(/\s+T-\d+/g, '');
  cleaned = cleaned.replace(/\s+(STORE|WHSE|MKT)\s+#?\d+/gi, '');
  cleaned = cleaned.replace(/\s+F\d{4,}\b/g, '');
  cleaned = cleaned.replace(/\s+\d{4,}\b/g, '');

  // 6. Strip trailing location tokens (e.g. " - AUSTIN", " - CHICAGO")
  cleaned = cleaned.replace(/\s*-\s*[A-Z\s]+$/i, '');

  // 7. Strip trailing state abbreviations (e.g. " IL", " WA", " CA")
  cleaned = cleaned.replace(/\s+[A-Z]{2}\s*$/i, '');

  // 8. Re-test against known merchants after clearing noise
  for (const rule of KNOWN_MERCHANT_RULES) {
    if (rule.pattern.test(cleaned)) {
      return {
        cleanName: rule.cleanName,
        ...(rule.websiteUrl ? { websiteUrl: rule.websiteUrl } : {}),
      };
    }
  }

  // 9. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return { cleanName: 'Unknown' };
  }

  // 10. Format unknown merchant using title casing
  return {
    cleanName: toTitleCase(cleaned),
  };
}
