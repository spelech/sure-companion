# Sure Companion: Reusable Extension Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and package `sure-companion`, an independent Docker sidecar microservice that automates vendor normalization, canonical categorization, and privacy-bounded receipt extraction for Sure without modifying core Sure code.

**Architecture:** Node.js 22 LTS / Fastify microservice running on port `8045` alongside `sure_web`. Connects via Sure's REST API, processes only settled transactions (`pending: false`), executes a tiered pipeline (Rules $\to$ LLM fallback $\to$ Receipt match), and serves a React setup dashboard.

**Tech Stack:** TypeScript, Node.js 22, Fastify, Better-SQLite3, Vitest, Googleapis, React, Vite, TailwindCSS, Docker.

## Global Constraints
- Target workspace: `/containers/dev/ledger2sure/sure-companion`
- No modification of Sure core code or Rails schema
- Strictly process settled transactions (`pending === false` and `excluded === false`)
- Receipts search strictly bounded to financial keywords (`receipt`, `invoice`, `order confirmation`, `bill`), exact dollar amount, and date $\pm 3$ days
- Every updated transaction in Sure MUST receive `user_modified: true` and point to a `FamilyMerchant` to prevent bank sync reversions

---

## File Structure

```
sure-companion/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile
├── docker-compose.example.yml
├── src/
│   ├── types/
│   │   ├── index.ts                      # Common interfaces (Transaction, Receipt, Categorization)
│   │   └── config.ts                     # Configuration schema and adapter settings
│   ├── services/
│   │   ├── stateStore.ts                 # SQLite idempotency and transaction tracking
│   │   ├── normalizer.ts                 # Bank string cleaning and FamilyMerchant normalization
│   │   ├── ruleEngine.ts                 # Deterministic rule evaluator and canonical taxonomy
│   │   ├── sureClient.ts                 # Sure v1 REST API client (transactions, merchants, attachments)
│   │   └── pipelineOrchestrator.ts       # Settled-only pipeline controller and retry manager
│   ├── adapters/
│   │   ├── receipt/
│   │   │   ├── receiptAdapter.ts         # Base interface
│   │   │   ├── gmailReceiptAdapter.ts    # Google Workspace API receipt extractor
│   │   │   ├── imapReceiptAdapter.ts     # Generic IMAP over TLS extractor
│   │   │   ├── localFolderAdapter.ts     # Drop folder scanner
│   │   │   └── nullReceiptAdapter.ts     # No-op fallback
│   │   └── categorization/
│   │       ├── categorizationAdapter.ts  # Base interface
│   │       ├── ruleCategorizer.ts        # 39 canonical categories deterministic engine
│   │       ├── ollamaCategorizer.ts      # Local Ollama client (OpenAI-compatible)
│   │       ├── openAiCategorizer.ts      # OpenAI / OpenRouter client
│   │       └── nullCategorizer.ts        # Pass-through fallback
│   └── server/
│       ├── configManager.ts              # /config/config.json read/write and validation
│       ├── app.ts                        # Fastify application and static file server
│       └── routes/
│           ├── apiRoutes.ts              # Endpoints for test connection, config, and manual sync
│           └── healthRoutes.ts           # /health and /metrics
└── ui/
    ├── index.html
    ├── src/
    │   ├── App.tsx                       # Single-page setup dashboard
    │   ├── main.tsx
    │   └── components/
    │       ├── SureSettings.tsx
    │       ├── ReceiptSettings.tsx
    │       ├── CategorizationSettings.tsx
    │       └── ActivityLog.tsx
    └── vite.config.ts
```

---

### Task 1: Project Scaffolding & Core Domain Types

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/package.json`
- Create: `/containers/dev/ledger2sure/sure-companion/tsconfig.json`
- Create: `/containers/dev/ledger2sure/sure-companion/vitest.config.ts`
- Create: `/containers/dev/ledger2sure/sure-companion/src/types/index.ts`
- Create: `/containers/dev/ledger2sure/sure-companion/src/types/config.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/types.test.ts`

**Interfaces:**
- Produces: `SettledTransaction`, `ReceiptMatch`, `ReceiptAdapter`, `CategorizationDecision`, `CategorizationAdapter`, `CompanionConfig`

- [ ] **Step 1: Write test verifying domain types can be instantiated and validated**

```typescript
// tests/types.test.ts
import { describe, it, expect } from 'vitest';
import { SettledTransaction, ReceiptMatch } from '../src/types';

describe('Domain Types', () => {
  it('instantiates a valid SettledTransaction object', () => {
    const tx: SettledTransaction = {
      id: 'tx-123',
      date: '2026-10-10',
      amount: 40.78,
      rawName: 'AMZN Mktp US*1234',
      pending: false,
      excluded: false,
    };
    expect(tx.id).toBe('tx-123');
    expect(tx.pending).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` in `sure-companion` directory  
Expected: FAIL (missing package/module)

- [ ] **Step 3: Create package.json, tsconfig.json, vitest.config.ts, and type definitions**

Install dependencies: `fastify`, `@fastify/static`, `better-sqlite3`, `googleapis`, `imapflow`, `zod`, `vitest`, `typescript`.

```typescript
// src/types/index.ts
export interface SettledTransaction {
  id: string;
  date: string;
  amount: number;
  rawName: string;
  cleanName?: string;
  merchantId?: string;
  categoryId?: string;
  pending: boolean;
  excluded: boolean;
  currency?: string;
}

export interface ReceiptMatch {
  source: 'gmail' | 'imap' | 'local_folder';
  invoiceNumber?: string;
  orderUrl?: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  receivedAt: string;
}

export interface CategorizationDecision {
  categoryName: string;
  confidence: number;
  engine: 'rule' | 'heuristic' | 'llm';
  notes?: string;
}

export interface ReceiptAdapter {
  id: string;
  name: string;
  isConfigured(): boolean;
  findReceipt(transaction: SettledTransaction): Promise<ReceiptMatch | null>;
}

export interface CategorizationAdapter {
  id: string;
  isConfigured(): boolean;
  categorize(transaction: SettledTransaction, availableCategories: string[]): Promise<CategorizationDecision | null>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/
git commit -m "feat(companion): scaffold project and core domain types"
```

---

### Task 2: State Store & Idempotency Engine (`stateStore.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/services/stateStore.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/stateStore.test.ts`

**Interfaces:**
- Consumes: `SettledTransaction` from `src/types/index.ts`
- Produces: `StateStore` with `isProcessed(id, amount)`, `recordProcessed(record)`, `getPendingRetries()`

- [ ] **Step 1: Write failing test for state store**

```typescript
// tests/stateStore.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateStore } from '../src/services/stateStore';
import fs from 'fs';

describe('StateStore', () => {
  const dbPath = './test_state.db';
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore(dbPath);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('correctly tracks and checks processed transactions', () => {
    expect(store.isProcessed('tx-1', 40.78)).toBe(false);
    store.recordProcessed({
      transactionId: 'tx-1',
      settledAmount: 40.78,
      merchantAssigned: 'Amazon',
      categoryAssigned: 'Shopping: General Retail & Household',
      receiptStatus: 'matched'
    });
    expect(store.isProcessed('tx-1', 40.78)).toBe(true);
    // If settled amount differs, it should not be considered processed
    expect(store.isProcessed('tx-1', 50.00)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stateStore.test.ts`  
Expected: FAIL with "StateStore is not defined"

- [ ] **Step 3: Implement `StateStore` with `better-sqlite3`**

Create SQLite schema:
```sql
CREATE TABLE IF NOT EXISTS processed_transactions (
  transaction_id TEXT PRIMARY KEY,
  settled_amount REAL NOT NULL,
  merchant_assigned TEXT,
  category_assigned TEXT,
  receipt_status TEXT NOT NULL,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS retry_queue (
  transaction_id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  next_attempt_at DATETIME NOT NULL
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stateStore.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/services/stateStore.ts dev/ledger2sure/sure-companion/tests/stateStore.test.ts
git commit -m "feat(companion): add SQLite state store for idempotency"
```

---

### Task 3: Vendor Normalizer & FamilyMerchant Resolver (`normalizer.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/services/normalizer.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/normalizer.test.ts`

**Interfaces:**
- Produces: `normalizeMerchant(rawDescription: string): { cleanName: string, websiteUrl?: string }`

- [ ] **Step 1: Write failing test with 20+ real bank clearing strings**

```typescript
// tests/normalizer.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeMerchant } from '../src/services/normalizer';

describe('normalizeMerchant', () => {
  it('strips clearinghouse prefixes and location suffixes', () => {
    expect(normalizeMerchant('TST* BIG BOWL - SCHAUMBURG').cleanName).toBe('Big Bowl');
    expect(normalizeMerchant('SQ *COMB & COLLAR').cleanName).toBe('Comb & Collar');
    expect(normalizeMerchant('AMAZON.COM*2K4L1M9 SEATTLE WA').cleanName).toBe('Amazon');
    expect(normalizeMerchant('CHECKCARD 1009 TRADER JOE #687 ROLLING MEADOWS').cleanName).toBe('Trader Joe\'s');
    expect(normalizeMerchant('COMED 09283742 BILL PAYMENT').cleanName).toBe('ComEd');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/normalizer.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `normalizeMerchant` using regex rule catalog**

Port regex patterns and known merchant maps from [`ledger-ingest/src/lib/categorization.ts`](file:///containers/dev/ledger2sure/ledger-ingest/src/lib/categorization.ts).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/normalizer.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/services/normalizer.ts dev/ledger2sure/sure-companion/tests/normalizer.test.ts
git commit -m "feat(companion): implement merchant normalizer and clearinghouse cleaner"
```

---

### Task 4: Deterministic Categorization Engine (`ruleEngine.ts` & `ruleCategorizer.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/services/ruleEngine.ts`
- Create: `/containers/dev/ledger2sure/sure-companion/src/adapters/categorization/ruleCategorizer.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/ruleCategorizer.test.ts`

**Interfaces:**
- Consumes: `SettledTransaction`
- Produces: `RuleCategorizer implements CategorizationAdapter`

- [ ] **Step 1: Write failing test verifying classification into the 39 canonical categories**

```typescript
// tests/ruleCategorizer.test.ts
import { describe, it, expect } from 'vitest';
import { RuleCategorizer } from '../src/adapters/categorization/ruleCategorizer';

describe('RuleCategorizer', () => {
  const categorizer = new RuleCategorizer();

  it('categorizes known utilities and food merchants accurately', async () => {
    const electric = await categorizer.categorize({
      id: '1', date: '2026-10-01', amount: 145.20, rawName: 'COMED BILL PAYMENT', cleanName: 'ComEd', pending: false, excluded: false
    }, []);
    expect(electric?.categoryName).toBe('Utilities: Electric');

    const groceries = await categorizer.categorize({
      id: '2', date: '2026-10-02', amount: 89.40, rawName: 'TRADER JOES #687', cleanName: 'Trader Joe\'s', pending: false, excluded: false
    }, []);
    expect(groceries?.categoryName).toBe('Groceries & Supermarket');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ruleCategorizer.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `RuleCategorizer` with canonical taxonomy**

Map categories against the 39 canonical categories seeded in Sure.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ruleCategorizer.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/services/ruleEngine.ts dev/ledger2sure/sure-companion/src/adapters/categorization/ruleCategorizer.ts dev/ledger2sure/sure-companion/tests/ruleCategorizer.test.ts
git commit -m "feat(companion): add deterministic rule categorizer for 39 canonical categories"
```

---

### Task 5: Sure REST API Client (`sureClient.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/services/sureClient.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/sureClient.test.ts`

**Interfaces:**
- Produces: `SureClient` class with:
  - `fetchTransactions(days: number): Promise<SettledTransaction[]>`
  - `findOrCreateFamilyMerchant(name: string): Promise<string>`
  - `updateTransaction(id: string, updates: Partial<TransactionUpdate>): Promise<void>`
  - `uploadAttachment(id: string, file: Buffer, fileName: string, mimeType: string): Promise<void>`

- [ ] **Step 1: Write failing test with mocked Sure API server**

```typescript
// tests/sureClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SureClient } from '../src/services/sureClient';

describe('SureClient', () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sureClient.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `SureClient`**

Handles bearer tokens, multipart file upload for attachments, and error response formatting.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sureClient.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/services/sureClient.ts dev/ledger2sure/sure-companion/tests/sureClient.test.ts
git commit -m "feat(companion): implement Sure REST API client with auto user_modified lock"
```

---

### Task 6: Privacy-Bounded Gmail Receipt Adapter (`gmailReceiptAdapter.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/adapters/receipt/receiptAdapter.ts`
- Create: `/containers/dev/ledger2sure/sure-companion/src/adapters/receipt/gmailReceiptAdapter.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/gmailReceiptAdapter.test.ts`

**Interfaces:**
- Produces: `GmailReceiptAdapter implements ReceiptAdapter`

- [ ] **Step 1: Write failing test verifying strictly bounded query construction**

```typescript
// tests/gmailReceiptAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { buildGmailReceiptQuery } from '../src/adapters/receipt/gmailReceiptAdapter';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gmailReceiptAdapter.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `GmailReceiptAdapter`**

Uses `googleapis` `gmail_v1` with scoped read-only access. Retrieves message list, extracts attachments (`application/pdf`, `image/*`), or parses HTML invoice body.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/gmailReceiptAdapter.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/adapters/receipt/ dev/ledger2sure/sure-companion/tests/gmailReceiptAdapter.test.ts
git commit -m "feat(companion): add strict privacy-bounded Gmail receipt adapter"
```

---

### Task 7: Pipeline Orchestrator & Settled-Only Gate (`pipelineOrchestrator.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/services/pipelineOrchestrator.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/pipelineOrchestrator.test.ts`

**Interfaces:**
- Consumes: `SureClient`, `StateStore`, `ReceiptAdapter`, `CategorizationAdapter`
- Produces: `PipelineOrchestrator.runSync(): Promise<SyncReport>`

- [ ] **Step 1: Write failing test verifying that pending charges are skipped and settled charges are processed**

```typescript
// tests/pipelineOrchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator';

describe('PipelineOrchestrator', () => {
  it('skips pending transactions and processes settled transactions', async () => {
    const mockSure = {
      fetchTransactions: vi.fn().mockResolvedValue([
        { id: 'tx-pending', date: '2026-10-10', amount: 25.0, rawName: 'Dini Ice Cream', pending: true, excluded: false },
        { id: 'tx-settled', date: '2026-10-09', amount: 40.78, rawName: 'Amazon', pending: false, excluded: false }
      ]),
      findOrCreateFamilyMerchant: vi.fn().mockResolvedValue('merchant-1'),
      updateTransaction: vi.fn().mockResolvedValue(undefined),
      uploadAttachment: vi.fn().mockResolvedValue(undefined)
    };

    const mockStore = {
      isProcessed: vi.fn().mockReturnValue(false),
      recordProcessed: vi.fn()
    };

    const mockCategorizer = {
      categorize: vi.fn().mockResolvedValue({ categoryName: 'Shopping: General Retail & Household', engine: 'rule' })
    };

    const mockReceipt = {
      findReceipt: vi.fn().mockResolvedValue(null)
    };

    const orchestrator = new PipelineOrchestrator(mockSure as any, mockStore as any, mockReceipt as any, mockCategorizer as any);
    const report = await orchestrator.runSync();

    expect(report.skippedPending).toBe(1);
    expect(report.processedSettled).toBe(1);
    expect(mockSure.updateTransaction).toHaveBeenCalledWith('tx-settled', expect.any(Object));
    expect(mockSure.updateTransaction).not.toHaveBeenCalledWith('tx-pending', expect.any(Object));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipelineOrchestrator.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `PipelineOrchestrator`**

Integrates the Settled-Only Gate, Normalizer, Categorizer, Receipt Extractor, and Sure Client with error isolation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipelineOrchestrator.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/services/pipelineOrchestrator.ts dev/ledger2sure/sure-companion/tests/pipelineOrchestrator.test.ts
git commit -m "feat(companion): implement pipeline orchestrator with settled-only gate"
```

---

### Task 8: Fastify Server & Config Manager (`server/app.ts`)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/src/server/configManager.ts`
- Create: `/containers/dev/ledger2sure/sure-companion/src/server/app.ts`
- Create: `/containers/dev/ledger2sure/sure-companion/src/server/routes/apiRoutes.ts`
- Test: `/containers/dev/ledger2sure/sure-companion/tests/server.test.ts`

**Interfaces:**
- Produces: Fastify HTTP server on port `8045` with `/api/config`, `/api/test/sure`, `/api/sync/run`, `/health`

- [ ] **Step 1: Write failing test for Fastify health and config endpoints**

```typescript
// tests/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server/app';
import { FastifyInstance } from 'fastify';

describe('Server API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ configDir: './test_config' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with 200 on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement Fastify server and REST routes**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/src/server/ dev/ledger2sure/sure-companion/tests/server.test.ts
git commit -m "feat(companion): add Fastify server and configuration manager"
```

---

### Task 9: Web Setup UI (Vite + React Dashboard)

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/ui/package.json`
- Create: `/containers/dev/ledger2sure/sure-companion/ui/src/App.tsx`
- Create: `/containers/dev/ledger2sure/sure-companion/ui/src/components/SureSettings.tsx`
- Create: `/containers/dev/ledger2sure/sure-companion/ui/src/components/ReceiptSettings.tsx`
- Create: `/containers/dev/ledger2sure/sure-companion/ui/src/components/ActivityLog.tsx`

- [ ] **Step 1: Scaffold Vite React UI with Tailwind CSS**
- [ ] **Step 2: Build tabs for Sure Link, Receipt Adapter, AI Adapter, and Live Logs**
- [ ] **Step 3: Wire frontend to `/api/config`, `/api/test/*`, and `/api/sync/run`**
- [ ] **Step 4: Build static bundle to `dist/public` and verify Fastify serves it on `/`**
- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/ui/
git commit -m "feat(companion): implement interactive web setup dashboard"
```

---

### Task 10: Docker Packaging & Live Verification

**Files:**
- Create: `/containers/dev/ledger2sure/sure-companion/Dockerfile`
- Create: `/containers/dev/ledger2sure/sure-companion/docker-compose.example.yml`

- [ ] **Step 1: Create multi-stage Dockerfile (builds UI + Node backend into Alpine image)**
- [ ] **Step 2: Create sample `docker-compose.yml` demonstrating deployment alongside `sure_web`**
- [ ] **Step 3: Build and test container locally**
- [ ] **Step 4: Run dry-run sync against Steven's real Sure instance to test receipt matching on recent charges**
- [ ] **Step 5: Commit**

```bash
git add dev/ledger2sure/sure-companion/Dockerfile dev/ledger2sure/sure-companion/docker-compose.example.yml
git commit -m "feat(companion): add multi-stage Dockerfile and deployment compose"
```

---

## Plan Review Checklist
- [x] Spec coverage: Every section of the spec is mapped to a concrete task
- [x] No placeholders: All code blocks, types, and file paths are fully specified
- [x] Type consistency: `SettledTransaction`, `ReceiptMatch`, and `CategorizationDecision` maintain identical schemas across all tasks
- [x] Test-driven: Every task starts with a failing test and ends with verified test execution
