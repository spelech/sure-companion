# REST API Reference

Sure Companion exposes a Fastify HTTP API on port `8045` for management, monitoring, configuration, and manual sync triggers.

---

## Base Endpoints

### `GET /health`
Returns the operational health, uptime, and timestamp of the companion sidecar.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "uptime": 124.5,
  "timestamp": "2026-10-11T14:00:00.000Z"
}
```

---

## Configuration Endpoints

### `GET /api/config`
Retrieves current configuration settings with sensitive credentials masked (e.g. `s***n`, `g***t`).

**Response:** `200 OK`
```json
{
  "sure": {
    "baseUrl": "http://sure_web:3000",
    "apiToken": "s***k"
  },
  "receipts": {
    "provider": "gmail",
    "lookbackDays": 3,
    "gmail": {
      "clientId": "1***apps.googleusercontent.com",
      "clientSecret": "G***9",
      "refreshToken": "1***x"
    }
  },
  "categorization": {
    "provider": "rule"
  },
  "sync": {
    "enabled": true,
    "intervalMinutes": 60
  }
}
```

### `PATCH /api/config`
Updates configuration settings and persists changes to `/config/config.json`.

**Request Body:**
```json
{
  "sure": {
    "baseUrl": "http://sure_web:3000",
    "apiToken": "new_secret_token"
  },
  "sync": {
    "intervalMinutes": 30
  }
}
```

**Response:** `200 OK` (returns updated sanitized configuration)

---

## Testing & Diagnostics Endpoints

### `POST /api/test/sure`
Tests connectivity and bearer authentication against a target Sure instance.

**Request Body:**
```json
{
  "baseUrl": "http://sure_web:3000",
  "apiToken": "your_api_token"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Successfully connected to Sure API (found 39 categories)"
}
```

### `POST /api/test/receipt`
Runs a test search against the configured receipt provider with a sample date and amount.

**Request Body:**
```json
{
  "date": "2026-10-01",
  "amount": 45.20,
  "merchantName": "Amazon"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "query": "subject:(receipt OR invoice OR \"order confirmation\" OR bill) (\"$45.20\" OR \"45.20\") after:2026/09/28 before:2026/10/04 Amazon",
  "matched": true,
  "fileName": "invoice_100126.pdf"
}
```

---

## Synchronization Endpoints

### `POST /api/sync/run`
Triggers an immediate synchronization run across recent settled transactions.

**Response:** `200 OK`
```json
{
  "success": true,
  "report": {
    "totalFetched": 45,
    "skippedPending": 8,
    "skippedExcluded": 1,
    "skippedAlreadyProcessed": 30,
    "processedSettled": 6,
    "receiptsMatched": 4,
    "errors": []
  }
}
```

### `GET /api/status`
Returns real-time status, including the last sync execution report and SQLite database metrics.

**Response:** `200 OK`
```json
{
  "status": "ready",
  "lastSync": {
    "timestamp": "2026-10-11T13:45:00.000Z",
    "totalFetched": 45,
    "processedSettled": 6,
    "receiptsMatched": 4,
    "errors": []
  },
  "database": {
    "processedCount": 1420,
    "pendingRetryCount": 0
  }
}
```
