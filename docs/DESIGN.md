# Sure Companion: Reusable Extension Modules for Sure

**Author:** Steven T. Pelech  
**Date:** 2026-10-11  
**Target Application:** Sure (Rails 8 / Hotwire personal finance system)  
**Status:** Validated Design Spec  

---

## 1. Context & Motivation

[Sure](https://github.com/we-promise/sure) is an open-source, self-hosted personal finance platform. While it provides bank sync aggregators (SimpleFIN, Plaid, Akahu), users encounter several challenges in real-world deployments:
1. **Aggregator Noise & Reversion:** Bank sync feeds provide raw clearinghouse strings (e.g., `TST* ALPANA SCHAUMBURG IL`, `SQ *COMB & COLLAR`). If a user cleans a merchant name without locking it, subsequent aggregator syncs can revert the name.
2. **Category Inconsistency:** Aggregators and bank feeds assign hundreds of fragmented, overlapping categories.
3. **Missing Receipt/Invoice Evidence:** Banking feeds supply only date and dollar amounts, requiring manual hunting in email inboxes for itemized receipts.
4. **Varied Community Environments:** Members of the self-hosted Sure community have wildly varying access to external services:
   - Some have Google Workspace (Gmail API); others use standard IMAP (Fastmail, iCloud, Proton Mail Bridge) or no email access.
   - Some have local LLMs (Ollama) or cloud LLM API keys (OpenAI / Anthropic); others want 100% deterministic, zero-token offline rules.

This design specifies **Sure Companion** (`sure-companion`), a modular, decoupled sidecar container that brings automated vendor normalization, canonical categorization, and privacy-bounded receipt matching to the broader Sure community.

---

## 2. Goals & Non-Goals

### Goals
- **Zero-Touch Core:** Runs as an independent companion Docker container alongside official, unmodified Sure images (`ghcr.io/we-promise/sure:stable`).
- **Settled-Only Gate:** Strictly skips pending authorization holds. Enrichment and receipt searches execute only after transactions permanently settle and amounts are finalized.
- **Provider-Agnostic Plugin Architecture:** Standardized interfaces for receipt sources (`ReceiptAdapter`) and categorization engines (`CategorizationAdapter`).
- **Privacy-Bounded Receipt Extraction:** Receipt searches are strictly scoped to financial transactions (matching date $\pm 3$ days and exact settled dollar amount against invoices/receipts). Never scans personal correspondence or inbox timelines.
- **Aggregator Immunity:** Creates and maps transactions to `FamilyMerchant` records, automatically setting `user_modified = true` via Sure's REST API to prevent bank sync overwrites.
- **Web Setup UI:** Bundled single-page dashboard on port `8045` for point-and-click credential testing, adapter configuration, and activity inspection.

### Non-Goals
- Modifying Sure's core Ruby on Rails codebase or database schema directly.
- Scraping general email inboxes or building full-life personal context into the receipt module.
- Running live OCR on general paper receipts through camera scanners (focused on digital email/PDF receipts).

---

## 3. Architecture & Container Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                 Docker Host                  │
                  │                                              │
                  │   ┌──────────────────┐                       │
                  │   │     sure_web     │ (Stock Image)         │
                  │   │ (Official Rails) │                       │
                  │   └────────▲─────────┘                       │
                  │            │ REST API (Bearer Token)         │
                  │            │                                 │
Browser ──────►   │   ┌────────┴─────────┐                       │
(Port 8045)       │   │  sure-companion  │ (Node 22 / Fastify)   │
                  │   │  ┌─────────────┐ │                       │
                  │   │  │ Web Setup UI│ │ ◄── Persistent Volume │
                  │   │  │ Core Engine │ │     (/config)         │
                  │   │  │ Adapters    │ │                       │
                  │   │  └─────────────┘ │                       │
                  │   └────────┬─────────┘                       │
                  └────────────┼─────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐            ┌────────────────────────┐
│ Google Workspace / IMAP│            │ AI Providers (Optional)│
│ (Receipt Searches Only)│            │ • Local Ollama         │
│                        │            │ • OpenAI / OpenRouter  │
└────────────────────────┘            └────────────────────────┘
```

### Container Specifications
* **Base Runtime:** Node.js 22 LTS Alpine with Fastify backend and embedded React dashboard.
* **Ports:** `8045` (Web UI & health/metrics endpoints).
* **Storage:** Mounted volume `/config` containing:
  - `config.json`: User configuration, enabled adapters, and scheduled intervals.
  - `companion_state.db`: SQLite database for idempotency, tracking processed transaction IDs and retry queues.
  - `receipts_drop/`: Optional local directory for manual PDF receipt drops.
* **Network:** Attached to Sure's Docker network (e.g., `net_services`), communicating via Sure's internal REST endpoints (`http://sure_web:3000/api/v1`) or external URL.

---

## 4. Plugin Interfaces & Adapter Specifications

All modular capabilities implement strict TypeScript contracts.

### 4.1 Receipt Adapter (`ReceiptAdapter`)
```typescript
export interface ReceiptMatch {
  source: 'gmail' | 'imap' | 'local_folder';
  invoiceNumber?: string;
  orderUrl?: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  receivedAt: string;
}

export interface ReceiptAdapter {
  id: string;
  name: string;
  isConfigured(): boolean;
  findReceipt(transaction: SettledTransaction): Promise<ReceiptMatch | null>;
}
```

#### Supported Adapters:
1. **`GmailReceiptAdapter`**:
   - Authenticates via Google Workspace OAuth 2.0 or Service Account.
   - Query filter:
     ```
     subject:(receipt OR invoice OR "order confirmation" OR bill) ("$<amount>" OR "<amount>") after:<date-3d> before:<date+3d>
     ```
   - Downloads PDF attachments or renders HTML transaction receipts into PDF.
2. **`ImapReceiptAdapter`**:
   - Connects to standard IMAP over TLS (Fastmail, iCloud, Proton Mail Bridge, custom mail servers).
   - Searches `SINCE <date-3d> BEFORE <date+3d>` matching subjects and amounts.
3. **`LocalFolderReceiptAdapter`**:
   - Inspects `/config/receipts_drop/` for files matching `<amount>_*.pdf` or `<date>_<amount>.pdf`.
4. **`NullReceiptAdapter`**:
   - Default no-op when receipt searching is disabled.

---

### 4.2 Categorization Adapter (`CategorizationAdapter`)
```typescript
export interface CategorizationDecision {
  categoryName: string;
  confidence: number;
  engine: 'rule' | 'heuristic' | 'llm';
  notes?: string;
}

export interface CategorizationAdapter {
  id: string;
  isConfigured(): boolean;
  categorize(transaction: SettledTransaction, availableCategories: string[]): Promise<CategorizationDecision | null>;
}
```

#### Tiered Execution:
1. **Tier 1: Deterministic Rules (Always Active, Zero Cost):**
   - Matches regex patterns, merchant aliases, and Zelle descriptions from the user's rule catalog.
   - Evaluated locally in microseconds with 100% deterministic accuracy.
2. **Tier 2: LLM Fallback (Optional):**
   - Executes only when Tier 1 produces no match.
   - `OllamaCategorizer`: Calls local Ollama server (e.g. `llama3.2`, `deepseek-r1:8b`) via OpenAI-compatible API.
   - `OpenAICategorizer`: Calls OpenAI or OpenRouter API.
   - `NullCategorizer`: Leaves the transaction unassigned for user review.

---

### 4.3 Normalizer Plugin (`NormalizerPlugin`)
- Strips clearinghouse and payment processor noise:
  - Regex patterns: `^TST\*\s*`, `^SQ\s*\*\s*`, `^SP\s*\*\s*`, `^PY\s*\*`, `^CHECKCARD\s+\d+\s+`
  - Location and terminal suffixes: `\s+#\d+.*$`, `\s+[A-Z]{2}\s+\d{5}$`
- Matches or generates clean **`FamilyMerchant`** records in Sure so subsequent aggregator syncs never revert names.

---

## 5. Settled-Only Pipeline & Data Flow

```
                      Scheduled Trigger / Webhook
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │ 1. GET /api/v1/transactions       │
                 │    (Fetch recent 14-day window)   │
                 └─────────────────┬─────────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │ 2. Settled-Only Gate              │
                 │    • pending === false            │
                 │    • excluded === false           │
                 │    • NOT in companion_state.db    │
                 └─────────────────┬─────────────────┘
                                   │ (Passed)
                                   ▼
                 ┌───────────────────────────────────┐
                 │ 3. Vendor Normalization           │
                 │    • Strip bank prefix/suffix     │
                 │    • Resolve FamilyMerchant ID    │
                 └─────────────────┬─────────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │ 4. Categorization (Tiered)        │
                 │    • Tier 1: Rules Engine         │
                 │    • Tier 2: LLM Fallback         │
                 └─────────────────┬─────────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │ 5. Receipt Extraction             │
                 │    • Search ReceiptAdapter        │
                 │    • Upload to Sure Attachments   │
                 └─────────────────┬─────────────────┘
                                   │
                                   ▼
                 ┌───────────────────────────────────┐
                 │ 6. Commit to Sure & Record State  │
                 │    • PATCH /api/v1/transactions/:id│
                 │      (merchant_id, category_id)   │
                 │    • Lock: user_modified = true   │
                 │    • Write to companion_state.db  │
                 └───────────────────────────────────┘
```

### Lifecycle Guarantees:
- **Authorization Hold Drift Protection:** If an initial restaurant charge is authorized at `$25.00` with `pending: true`, the Settled Gate ignores it. When the finalized charge posts at `$31.50` with `pending: false`, the pipeline searches for `$31.50`, finding the receipt with tip included.
- **Attachment Permanence:** Attachments are uploaded only to finalized, permanent transactions, eliminating orphaned attachments caused by Sure's `merge_with_duplicate!` destroying pending entries.

---

## 6. Web Setup UI & Configuration Store

Served directly on port `8045` by Fastify:
- **Sure Link Tab:** Configure `SURE_BASE_URL` and `SURE_API_TOKEN`. Includes a live "Test Connection" button that validates permissions and lists accounts.
- **Receipts Tab:** Select receipt provider (`Gmail OAuth`, `IMAP`, `Local Folder`, `Disabled`). Includes interactive test search modal: input a sample date and dollar amount to verify email queries.
- **Categorization & AI Tab:** Rule catalog editor, AI provider selector (`None`, `Ollama`, `OpenAI`). Includes "Test AI Prompt" button to measure latency and test JSON schema adherence.
- **Activity & Diagnostics Tab:** Real-time log table detailing skipped pending holds, matched receipts, and enriched entries. Features a manual "Sync Now" trigger.

---

## 7. Error Handling, Rate Limiting & Resilience

1. **Partial Failure Independence:** If categorization succeeds but receipt download fails (e.g., IMAP timeout or Gmail rate limit), the category and merchant updates are committed to Sure immediately. The receipt task is queued in `companion_state.db` as `retry_pending`.
2. **Sure API Backoff:** If Sure is temporarily unreachable, the companion applies exponential backoff (10s, 30s, 60s, max 5m) without crashing.
3. **LLM Circuit Breaker:** 3 consecutive LLM errors or timeouts trip the circuit breaker for 15 minutes, falling back entirely to deterministic rules to prevent pipeline stalls.
4. **Idempotency:** State is recorded in SQLite by transaction UUID and settled amount. If an aggregator resends a transaction with the same settled amount, it is skipped in 1ms.

---

## 8. Testing & Verification Plan

1. **Unit Testing:**
   - Normalizer regex test suite against 50+ real-world bank clearing strings (`TST*`, `SQ *`, `CHECKCARD`, location tags).
   - Mocked `GmailReceiptAdapter` and `ImapReceiptAdapter` unit tests validating date math, query formatting, and attachment buffer parsing.
   - Deterministic rule engine tests against the 39 canonical categories.
2. **Mock Integration Testing:**
   - Embedded mock Sure REST API verifying PATCH payloads, attachment uploads, and error responses.
3. **Live Verification:**
   - Verified against live test transactions in Sure (including recent settled October entries), confirming proper `FamilyMerchant` creation, category assignment, and receipt attachment.
