# Rules & Canonical Taxonomy Guide

Sure Companion provides a deterministic, zero-token categorization and normalization engine. It ensures that transactions synced from financial aggregators (SimpleFIN, Plaid, Akahu) are categorized consistently into a standard 39-category financial taxonomy and linked to clean merchant identities.

---

## 🏛️ The 39 Canonical Categories

The engine organizes all financial activity into 39 standardized categories across 7 high-level groups:

### 1. Income & Capital
- `Income: Payroll` — Direct deposits, salary, wages, contracting income.
- `Income: Interest & Passive` — High-yield savings interest, dividends, cash back.
- `Income: Health / HSA Reimbursement` — Insurance claim payouts, HSA distributions.
- `Investment: Brokerage & Capital Accumulation` — Contributions to taxable brokerages, IRA/Roth accounts.

### 2. Housing & Utilities
- `Housing: Mortgage Principal & Interest` — Mortgage payments, escrow distributions.
- `Housing: Home Maintenance & Improvement` — Hardware stores, contractors, repair services.
- `Housing: Home Furnishings` — Furniture, decor, home appliances.
- `Housing: Real Estate Taxes` — County/municipal property tax installments.
- `Housing: Rent & Temporary Housing` — Apartment rent, sublets, short-term lodging.
- `Utilities: Electric` — Power companies, municipal electric services.
- `Utilities: Gas` — Natural gas heating and supply.
- `Utilities: Internet & Cable` — Broadband ISPs, fiber internet.
- `Utilities: Cell Phone` — Mobile phone service and wireless carriers.
- `Utilities: Water & Waste` — Municipal water, sewer, trash, recycling.

### 3. Food & Dining
- `Groceries & Supermarket` — Grocery stores, supermarkets, wholesale clubs (Costco, Sam's).
- `Dining Out: Restaurants & Takeout` — Sit-down dining, delivery platforms (DoorDash, Uber Eats).
- `Dining Out: Fast Food & Coffee` — Quick service restaurants, coffee shops (Starbucks, Dunkin).
- `Dining Out: Workplace Meals` — Office cafeterias, corporate micro-markets.

### 4. Transportation
- `Transportation: Gasoline & Fuel` — Gas stations, EV charging networks.
- `Transportation: Tolls & Transit` — Highway tolls (I-PASS, E-ZPass), trains, subways, rideshares (Uber, Lyft).
- `Transportation: Auto Insurance & Care` — Auto insurance premiums, maintenance, oil changes, auto parts.
- `Debt Service: Vehicle Financing` — Auto loan payments, vehicle leases.

### 5. Family, Health & Personal
- `Education & Childcare` — Daycare centers, preschools, tuition, tutoring.
- `Medical & Healthcare` — Doctor visits, dental clinics, prescriptions, copays.
- `Pets & Pet Care` — Veterinary clinics, pet food, grooming, pet supplies.
- `Personal Care & Fitness` — Gym memberships, haircuts, salons, wellness.
- `Shopping: General Retail & Household` — Amazon, Target, Walmart, department stores.
- `Shopping: Clothing & Apparel` — Apparel, footwear, clothing retailers.
- `Shopping: Electronics & Technology` — Computer hardware, consumer electronics.

### 6. Entertainment & Leisure
- `Entertainment: Streaming & Media` — Netflix, Spotify, Disney+, YouTube Premium.
- `Entertainment: Hobbies & Recreation` — Gaming (Steam, Nintendo), hobbies, sports.
- `Technology: Software & Subscriptions` — Cloud storage (Google One, iCloud), developer tools, SaaS.
- `Travel, Lodging & Vacation` — Hotels, flights, vacation rentals.

### 7. Transfers & Administrative
- `Legal, Professional & Taxes` — Tax prep, CPA fees, legal counsel, government tax authorities.
- `Transfer: Internal Liquidity` — Credit card bill payments, transfers between linked depository accounts.
- `Transfer: Interspousal` — Transfers between spouses/domestic partners.
- `Transfer: Family Reimbursement` — Shared family expenses and reimbursements.
- `Transfer: Peer-to-Peer & Personal Reimbursements` — Zelle, Venmo, PayPal P2P splits.
- `General & Miscellaneous` — Unclassified items requiring manual inspection.

---

## ⚙️ How Rule Matching Works

The rule engine processes each transaction through an ordered evaluation pipeline:

```
Transaction ──► Custom Rules (User Config) ──► Default Rules (Built-in) ──► Heuristics Fallback ──► AI Categorizer (Optional)
```

### Rule Structure
Each rule defines:
```typescript
interface Rule {
  id?: string;
  pattern: string;           // Keyword or regex string
  rawPattern?: string;       // Pattern matching raw aggregator description
  cleanPattern?: string;     // Pattern matching cleaned merchant name
  matchField?: 'raw_description' | 'clean_name' | 'dual';
  targetMerchant?: string;   // Optional merchant name assignment
  targetCategory: string;    // Target canonical category name
  targetTags?: string[];     // Optional tags to apply
  priority?: number;         // Lower number = higher evaluation priority (e.g. 1-100)
  isActive?: boolean;
}
```

### Priority Ordering
- Rules with **lower numerical priority** execute first (e.g., priority `5` runs before priority `25`).
- Custom rules created by the user in `config.json` can override built-in default rules by specifying priority `1` to `9`.

### Pattern Matching Syntax
Patterns support two formats:
1. **Plain substring (case-insensitive):** e.g. `"STARBUCKS"` or `"WHOLE FOODS"`.
2. **Regex expressions:** e.g. `"/\\bALDI\\b/i"` or `"COMED|COMMONWEALTH EDISON"`.

---

## 🧹 Vendor Normalization

Sure Companion automatically cleans bank clearinghouse noise before categorization. The normalizer strips:
- Clearinghouse prefixes: `TST*`, `SQ *`, `SP *`, `PY *`, `CHECKCARD`, `POS DEBIT`, `PURCHASE AUTHORIZED ON MM/DD`
- Terminal codes and store numbers: `#1234`, `STORE 08432`, `WHSE #0384`, `T-0832`
- City, state, and zip code suffixes: `SEATTLE WA`, `CHICAGO IL`, `- DALLAS`
- Phone numbers: `800-555-0199`

When an updated transaction is committed to Sure, it creates a `FamilyMerchant` record and sets `user_modified: true`, preventing bank sync aggregators from overwriting your curated names.
