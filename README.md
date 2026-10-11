# Sure Companion

[![CI & Docker Release](https://github.com/spelech/sure-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/spelech/sure-companion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Container Image](https://img.shields.io/badge/Container-GHCR-blue?logo=docker)](https://github.com/spelech/sure-companion/pkgs/container/sure-companion)

A modular, zero-touch companion sidecar for [Sure](https://github.com/we-promise/sure) (Rails 8 personal finance platform). It automates vendor cleaning, canonical categorization, and privacy-bounded receipt extraction without requiring any code or schema modifications to upstream Sure.

---

## ⚡ Key Capabilities

- **Settled-Only Gate:** Strictly skips pending authorization holds (`pending === false` and `excluded === false`). Enrichment and receipt queries run only after charges settle, eliminating hold churn and restaurant tip discrepancies.
- **Vendor Normalization & Aggregator Lock:** Strips bank clearinghouse prefixes (`TST*`, `SQ *`, `SP *`, `CHECKCARD`, terminal numbers) and creates/links clean `FamilyMerchant` records in Sure. Updates are committed with `user_modified: true` so SimpleFIN/Plaid syncs never revert clean merchant names.
- **Canonical 39-Category Classification:** High-speed, zero-token deterministic rule engine mapping transactions to Sure's 39 canonical categories with priority weighting. Optional local Ollama or OpenAI fallback for unknown merchants.
- **Privacy-Bounded Gmail Receipt Extractor:** Searches Gmail **strictly** for purchase invoices/receipts matching exact dollar amounts and date $\pm 3$ days. Never inspects personal correspondence or emails without financial keywords. Downloads invoice PDFs/images and attaches them directly to Sure transactions.
- **SQLite State Store:** Local idempotency store (`companion_state.db`) tracking processed transaction IDs and managing retry queues.
- **Interactive Web Setup UI:** Built-in single-page dashboard on port `8045` for point-and-click configuration, interactive connection testing, sample receipt query execution, and real-time sync logs.

---

## 🏗️ Architecture

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

---

## 🚀 Quick Start (Docker Compose)

Add `sure-companion` alongside your existing `sure_web` service:

```yaml
services:
  sure_web:
    image: ghcr.io/we-promise/sure:stable
    restart: unless-stopped
    networks:
      - sure-network
    # ... your existing sure config ...

  sure-companion:
    image: ghcr.io/spelech/sure-companion:latest
    container_name: sure-companion
    restart: unless-stopped
    ports:
      - "8045:8045"
    volumes:
      - ./companion-config:/config
    environment:
      - PORT=8045
      - SURE_BASE_URL=http://sure_web:3000
      - SURE_API_TOKEN=your_sure_api_token_here
      # Optional: Receipt adapter (or configure via Web UI)
      - RECEIPTS_PROVIDER=gmail
      - GMAIL_CLIENT_ID=your_oauth_client_id
      - GMAIL_CLIENT_SECRET=your_oauth_client_secret
      - GMAIL_REFRESH_TOKEN=your_oauth_refresh_token
    networks:
      - sure-network
    depends_on:
      - sure_web

networks:
  sure-network:
    external: true
```

Once running, navigate to `http://localhost:8045` to open the Web Setup Dashboard.

---

## ⚙️ Configuration Reference

Configuration can be set via environment variables or managed interactively via `/config/config.json` in the web UI:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Web dashboard & HTTP port | `8045` |
| `SURE_BASE_URL` | Base URL of your Sure instance | `http://localhost:3000` |
| `SURE_API_TOKEN` | API Token created in Sure UI (`Settings -> API Keys`) | `""` |
| `RECEIPTS_PROVIDER` | Receipt source (`gmail`, `imap`, `local_folder`, `none`) | `none` |
| `RECEIPTS_LOOKBACK_DAYS` | Search window around transaction date ($\pm N$ days) | `3` |
| `GMAIL_CLIENT_ID` | Google Workspace OAuth Client ID | `""` |
| `GMAIL_CLIENT_SECRET` | Google Workspace OAuth Client Secret | `""` |
| `GMAIL_REFRESH_TOKEN` | Google Workspace OAuth Refresh Token | `""` |
| `IMAP_HOST` / `IMAP_USER` | IMAP host & username for non-Gmail setups | `""` |
| `CATEGORIZATION_PROVIDER` | AI fallback provider (`none`, `ollama`, `openai`) | `none` |
| `OLLAMA_HOST` | Local Ollama endpoint | `http://localhost:11434` |
| `SYNC_ENABLED` | Enable automated periodic background sync | `true` |
| `SYNC_INTERVAL_MINUTES` | Frequency of background synchronization runs | `60` |

---

---

## 📚 Documentation Guides

- [Rules & 39 Canonical Categories Taxonomy](docs/RULES_AND_TAXONOMY.md) — Comprehensive explanation of canonical categories, priority evaluation, and custom rule matching.
- [Privacy-Bounded Receipt Matching Guide](docs/RECEIPTS_GUIDE.md) — Zero-inspection contract, query bounding, and Google OAuth setup.
- [REST API Reference](docs/API_REFERENCE.md) — Full endpoint reference for configuration, health checks, testing, and sync execution.
- [System Architecture & Design Specification](docs/DESIGN.md) — Detailed container topology, data flow, and error isolation architecture.

---

## 🔒 Privacy & Security Guarantees

Sure Companion was built under strict security and privacy principles for community deployment:
1. **Settled-Only Gate:** Skips pending holds (`pending === false`). No temporary authorization churn or restaurant tip discrepancies are tracked.
2. **Financial-Only Receipt Matching:** Receipt search queries require both financial keywords (`receipt`, `invoice`, `order confirmation`, `bill`), exact dollar amount (`$X.XX`), and a tight date window ($\pm 3$ days). Never queries or reads personal correspondence.
3. **Local SQLite State:** Idempotency tracking is maintained entirely on your local filesystem (`/config/companion_state.db`). Zero data is phoned home or shared externally.
4. **Credential Masking:** All API tokens and OAuth secrets are masked when displayed in the dashboard or fetched via `/api/config`.
5. **Non-Root Container:** The production Docker image runs as an unprivileged user (`node`, UID 1000) on minimal Alpine Linux.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 22 LTS
- npm 10+

### Setup & Testing
```bash
# Clone the repository
git clone https://github.com/spelech/sure-companion.git
cd sure-companion

# Install dependencies
npm ci
cd ui && npm ci && cd ..

# Run all 71 unit & integration tests
npm test

# Build production bundle
npm run build

# Start local server
npm start
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
