import { google, gmail_v1 } from 'googleapis';
import { ReceiptAdapter, ReceiptMatch, SettledTransaction } from '../../types';

export interface GmailReceiptConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  refreshToken?: string;
  credentialsPath?: string;
  lookbackDays?: number;
}

interface MessagePart {
  partId?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }> | null;
  body?: {
    attachmentId?: string | null;
    size?: number | null;
    data?: string | null;
  } | null;
  parts?: MessagePart[] | null;
}

/**
 * Constructs a strict, privacy-bounded search query for finding receipts in Gmail.
 *
 * Strictly includes:
 * - subject:(receipt OR invoice OR "order confirmation" OR bill)
 * - exact dollar amount formatted as ("$X.XX" OR "X.XX")
 * - date window: after:YYYY/MM/DD before:YYYY/MM/DD (date ± lookbackDays)
 * - merchant name (e.g. Amazon, Costco)
 * Zero search across general inbox threads or non-financial keywords.
 */
export function buildGmailReceiptQuery(
  transaction: SettledTransaction,
  lookbackDays: number = 3
): string {
  const merchant = transaction.cleanName || transaction.rawName;
  const formattedAmount = Math.abs(transaction.amount).toFixed(2);

  const [yearStr, monthStr, dayStr] = transaction.date.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const d = parseInt(dayStr, 10);

  const txDate = new Date(Date.UTC(y, m - 1, d));
  const afterDate = new Date(txDate);
  afterDate.setUTCDate(afterDate.getUTCDate() - lookbackDays);

  // Gmail 'before' date is exclusive; add 1 extra day to make txDate + lookbackDays inclusive
  const beforeDate = new Date(txDate);
  beforeDate.setUTCDate(beforeDate.getUTCDate() + lookbackDays + 1);

  const formatUtcDate = (dt: Date): string => {
    const yr = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const da = String(dt.getUTCDate()).padStart(2, '0');
    return `${yr}/${mo}/${da}`;
  };

  const afterStr = formatUtcDate(afterDate);
  const beforeStr = formatUtcDate(beforeDate);

  return `${merchant} subject:(receipt OR invoice OR "order confirmation" OR bill) ("$${formattedAmount}" OR "${formattedAmount}") after:${afterStr} before:${beforeStr}`;
}

export class GmailReceiptAdapter implements ReceiptAdapter {
  public readonly id = 'gmail';
  public readonly name = 'Gmail';
  private readonly config?: GmailReceiptConfig;
  private gmailClient?: gmail_v1.Gmail;
  private readonly lookbackDays: number;

  constructor(config?: GmailReceiptConfig, injectedClient?: gmail_v1.Gmail) {
    this.config = config;
    this.lookbackDays = config?.lookbackDays ?? 3;
    if (injectedClient) {
      this.gmailClient = injectedClient;
    }
  }

  public isConfigured(): boolean {
    if (this.gmailClient) {
      return true;
    }
    if (this.config?.clientId && this.config?.clientSecret && this.config?.refreshToken) {
      return true;
    }
    if (this.config?.credentialsPath) {
      return true;
    }
    return false;
  }

  private getGmailClient(): gmail_v1.Gmail | null {
    if (this.gmailClient) {
      return this.gmailClient;
    }

    if (this.config?.clientId && this.config?.clientSecret && this.config?.refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      );
      oauth2Client.setCredentials({
        refresh_token: this.config.refreshToken,
      });
      this.gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
      return this.gmailClient;
    }

    return null;
  }

  public async findReceipt(transaction: SettledTransaction): Promise<ReceiptMatch | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const client = this.getGmailClient();
    if (!client) {
      return null;
    }

    const query = buildGmailReceiptQuery(transaction, this.lookbackDays);

    try {
      const listRes = await client.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 5,
      });

      const messages = listRes.data.messages;
      if (!messages || messages.length === 0) {
        return null;
      }

      for (const msgRef of messages) {
        if (!msgRef.id) continue;

        const msgRes = await client.users.messages.get({
          userId: 'me',
          id: msgRef.id,
          format: 'full',
        });

        const message = msgRes.data;
        const internalDate = message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : new Date().toISOString();

        // 1. Look for PDF or image attachments
        const attachmentMatch = await this.extractAttachment(
          client,
          message,
          transaction.id,
          internalDate
        );
        if (attachmentMatch) {
          return attachmentMatch;
        }

        // 2. Fall back to rendered HTML body
        const htmlMatch = this.extractHtmlBody(message, transaction.id, internalDate);
        if (htmlMatch) {
          return htmlMatch;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private getAllParts(payload?: MessagePart | null): MessagePart[] {
    if (!payload) return [];
    const parts: MessagePart[] = [payload];
    if (payload.parts && payload.parts.length > 0) {
      for (const child of payload.parts) {
        parts.push(...this.getAllParts(child));
      }
    }
    return parts;
  }

  private async extractAttachment(
    client: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message,
    transactionId: string,
    internalDate: string
  ): Promise<ReceiptMatch | null> {
    const parts = this.getAllParts(message.payload as MessagePart | null);

    // Look for PDF parts first, then image parts
    const pdfPart = parts.find((p) => p.mimeType === 'application/pdf');
    const imagePart = parts.find((p) => p.mimeType?.startsWith('image/'));
    const targetPart = pdfPart || imagePart;

    if (!targetPart) {
      return null;
    }

    let buffer: Buffer | null = null;

    if (targetPart.body?.attachmentId && message.id) {
      const attRes = await client.users.messages.attachments.get({
        userId: 'me',
        messageId: message.id,
        id: targetPart.body.attachmentId,
      });
      if (attRes.data.data) {
        buffer = Buffer.from(attRes.data.data, 'base64url');
      }
    } else if (targetPart.body?.data) {
      buffer = Buffer.from(targetPart.body.data, 'base64url');
    }

    if (!buffer) {
      return null;
    }

    const isPdf = targetPart.mimeType === 'application/pdf';
    const fallbackExt = isPdf ? 'pdf' : (targetPart.mimeType?.split('/')[1] || 'png');
    const fileName = targetPart.filename || `receipt-${transactionId}.${fallbackExt}`;

    return {
      source: 'gmail',
      invoiceNumber: this.extractInvoiceNumber(message),
      orderUrl: this.extractOrderUrl(message),
      fileName,
      mimeType: targetPart.mimeType || (isPdf ? 'application/pdf' : 'image/png'),
      fileBuffer: buffer,
      receivedAt: internalDate,
    };
  }

  private extractHtmlBody(
    message: gmail_v1.Schema$Message,
    transactionId: string,
    internalDate: string
  ): ReceiptMatch | null {
    const parts = this.getAllParts(message.payload as MessagePart | null);
    const htmlPart = parts.find((p) => p.mimeType === 'text/html' && p.body?.data);

    let htmlData: string | null = null;
    if (htmlPart?.body?.data) {
      htmlData = htmlPart.body.data;
    } else if (message.payload?.body?.data && message.payload?.mimeType === 'text/html') {
      htmlData = message.payload.body.data;
    }

    if (!htmlData) {
      return null;
    }

    const fileBuffer = Buffer.from(htmlData, 'base64url');

    return {
      source: 'gmail',
      invoiceNumber: this.extractInvoiceNumber(message),
      orderUrl: this.extractOrderUrl(message),
      fileName: `receipt-${transactionId}.html`,
      mimeType: 'text/html',
      fileBuffer,
      receivedAt: internalDate,
    };
  }

  private extractInvoiceNumber(message: gmail_v1.Schema$Message): string | undefined {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
    const snippet = message.snippet || '';

    const textToSearch = `${subject} ${snippet}`;
    const match = textToSearch.match(/(?:invoice|order)\s*(?:#|no\.?|num)?\s*([a-zA-Z0-9_-]{5,})/i);
    return match ? match[1] : undefined;
  }

  private extractOrderUrl(message: gmail_v1.Schema$Message): string | undefined {
    const snippet = message.snippet || '';
    const match = snippet.match(/https?:\/\/[^\s"'<>]+(?:order|invoice)[^\s"'<>]*/i);
    return match ? match[0] : undefined;
  }
}
