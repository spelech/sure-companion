# Privacy-Bounded Receipt Matching Guide

Sure Companion links purchase invoices and digital receipts directly to transactions in Sure without compromising email privacy or scanning personal correspondence.

---

## 🔒 Privacy & Security Architecture

Unlike generic email scrapers that index entire inboxes, Sure Companion operates under a strict **Zero-Inspection Contract**:

### 1. Settled-Only Execution Gate
Enrichment and receipt queries run **only** after a transaction has permanently posted (`pending === false` and `excluded === false`). This eliminates hold churn, temporary authorization holds, and restaurant tip discrepancies.

### 2. Strictly Bounded Search Queries
Every receipt query is constructed dynamically from a finalized transaction and searches **only** for financial keywords, exact amounts, and bounded dates:

```
subject:(receipt OR invoice OR "order confirmation" OR bill) ("$145.20" OR "145.20") after:2026/09/28 before:2026/10/04 ComEd
```

- **Subject Keyword Filter:** `receipt`, `invoice`, `"order confirmation"`, or `bill`.
- **Exact Dollar Amount:** Formatted both with and without currency symbols (`$X.XX` and `X.XX`).
- **Bounded Date Window:** Search is restricted to $\pm 3$ days from the transaction settlement date.
- **Zero Inbox Indexing:** Messages that do not match both the exact dollar amount and financial keywords are never queried, downloaded, or logged.

### 3. Direct Attachment to Sure
When an invoice PDF or image is found:
1. The attachment bytes are downloaded into temporary memory.
2. The file is uploaded directly to Sure's attachment endpoint (`POST /api/v1/transactions/:id/attachments`).
3. Memory buffers are immediately released. No copies are stored in cloud infrastructure or long-term disk caches.

---

## 🛠️ Setting Up Google Workspace / Gmail OAuth

To connect Gmail receipt extraction:

1. **Create a Google Cloud Project:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create a project (e.g., `Sure Companion`).

2. **Enable the Gmail API:**
   - Navigate to **APIs & Services > Library**.
   - Search for **Gmail API** and click **Enable**.

3. **Configure OAuth Consent Screen:**
   - Select **User Type: External** (or **Internal** if using a Google Workspace domain).
   - Set app name to `Sure Companion`.
   - Add the scope: `https://www.googleapis.com/auth/gmail.readonly`.
   - Add your Gmail address under **Test Users**.

4. **Create OAuth Client Credentials:**
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth Client ID**.
   - Application Type: **Web Application**.
   - Add Authorized redirect URI: `https://developers.google.com/oauthplayground` (or your local callback).
   - Save your **Client ID** and **Client Secret**.

5. **Generate Refresh Token (via OAuth Playground):**
   - Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
   - Click the gear icon in the top right and check **Use your own OAuth credentials**. Enter your Client ID and Client Secret.
   - Under Step 1, enter `https://www.googleapis.com/auth/gmail.readonly` and click **Authorize APIs**.
   - Log in and authorize the application.
   - Under Step 2, click **Exchange authorization code for tokens**.
   - Copy the generated **Refresh token**.

6. **Configure Sure Companion:**
   - Enter your `Client ID`, `Client Secret`, and `Refresh Token` either in the Web UI (`http://localhost:8045`) under **Receipt Settings**, or via environment variables in `docker-compose.yml`:
     ```yaml
     environment:
       - RECEIPTS_PROVIDER=gmail
       - GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
       - GMAIL_CLIENT_SECRET=your_client_secret
       - GMAIL_REFRESH_TOKEN=your_refresh_token
       - RECEIPTS_LOOKBACK_DAYS=3
     ```
   - Click **Test Search Query** in the dashboard to test a synthetic receipt lookup.
