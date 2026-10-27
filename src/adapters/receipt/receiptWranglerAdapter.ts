import { ReceiptAdapter, ReceiptMatch, SettledTransaction } from '../../types';

export interface ReceiptWranglerConfig {
  baseUrl?: string;
  publicUrl?: string;
  apiToken?: string;
  groupId?: number;
  lookbackDays?: number;
  autoSyncExternalReceipts?: boolean;
}

export class ReceiptWranglerAdapter implements ReceiptAdapter {
  public readonly id = 'receiptwrangler';
  public readonly name = 'Receipt Wrangler';
  private readonly baseUrl: string;
  private readonly publicUrl: string;
  private readonly apiToken?: string;
  private readonly groupId: number;
  private readonly lookbackDays: number;
  public readonly autoSyncExternalReceipts: boolean;

  constructor(config?: ReceiptWranglerConfig) {
    this.baseUrl = (config?.baseUrl || process.env.RECEIPTWRANGLER_BASE_URL || 'http://receiptwrangler:80').replace(/\/+$/, '');
    this.publicUrl = (config?.publicUrl || process.env.RECEIPTWRANGLER_PUBLIC_URL || 'https://receipts.wileyriley.com').replace(/\/+$/, '');
    this.apiToken = config?.apiToken || process.env.RECEIPTWRANGLER_API_TOKEN;
    this.groupId = config?.groupId ?? 1;
    this.lookbackDays = config?.lookbackDays ?? 5;
    this.autoSyncExternalReceipts = config?.autoSyncExternalReceipts ?? true;
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  private buildHeaders(includeJsonContentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.apiToken) {
      headers['X-Api-Key'] = this.apiToken;
      // Receipt Wrangler API keys start with 'key' and expect raw Authorization header without 'Bearer '
      headers['Authorization'] = this.apiToken.startsWith('key')
        ? this.apiToken
        : `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  public getPublicReceiptUrl(receiptId: string | number): string {
    return `${this.publicUrl}/receipts/${receiptId}`;
  }

  public async findReceipt(transaction: SettledTransaction): Promise<ReceiptMatch | null> {
    if (!this.baseUrl) return null;

    const txDate = new Date(transaction.date);
    const minDate = new Date(txDate);
    minDate.setDate(minDate.getDate() - this.lookbackDays);
    const maxDate = new Date(txDate);
    maxDate.setDate(maxDate.getDate() + this.lookbackDays);

    const headers = this.buildHeaders(true);

    try {
      const searchUrl = `${this.baseUrl}/api/receipt/group/${this.groupId}`;
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page: 1,
          pageSize: 100,
          orderBy: 'date',
          sortDirection: 'desc',
          fullReceipts: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`ReceiptWrangler search failed with status ${response.status}`);
      }

      const resData = (await response.json()) as any;
      const receipts: any[] = resData.data || resData.receipts || (Array.isArray(resData) ? resData : []);

      const targetAmount = Math.abs(transaction.amount);

      // Find receipt matching amount (±$0.05) and date range
      const match = receipts.find((r: any) => {
        const rAmount = Math.abs(Number(r.amount));
        const amountMatches = Math.abs(rAmount - targetAmount) <= 0.05;
        if (!amountMatches) return false;

        const rDate = new Date(r.date);
        return rDate >= minDate && rDate <= maxDate;
      });

      if (!match || !match.imageFiles || match.imageFiles.length === 0) {
        return null;
      }

      const imageFile = match.imageFiles[0];
      const imageId = imageFile.id;
      const downloadUrl = `${this.baseUrl}/api/receiptImage/${imageId}/download`;

      const dlResponse = await fetch(downloadUrl, {
        method: 'GET',
        headers,
      });

      if (!dlResponse.ok) {
        throw new Error(`Failed to download image from ReceiptWrangler (${dlResponse.status})`);
      }

      const arrayBuffer = await dlResponse.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const mimeType =
        imageFile.fileType ||
        dlResponse.headers.get('content-type') ||
        'image/jpeg';
      const fileName =
        imageFile.fileName ||
        imageFile.name ||
        `receiptwrangler_${match.id || imageId}.jpg`;

      return {
        source: 'receiptwrangler',
        invoiceNumber: String(match.id || ''),
        orderUrl: this.getPublicReceiptUrl(match.id),
        fileName,
        mimeType,
        fileBuffer,
        receivedAt: match.date || new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn(`[ReceiptWranglerAdapter] Query failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Marks an existing Receipt Wrangler receipt as RESOLVED once linked to a Sure transaction.
   */
  public async markReceiptResolved(receiptId: string | number, sureTransactionId: string): Promise<boolean> {
    if (!this.baseUrl || !receiptId) return false;
    const headers = this.buildHeaders(true);
    try {
      const getRes = await fetch(`${this.baseUrl}/api/receipt/${receiptId}`, {
        method: 'GET',
        headers,
      });
      if (!getRes.ok) return false;
      const existing = (await getRes.json()) as any;
      if (existing.status === 'RESOLVED') return true;

      const updatedPayload = {
        ...existing,
        status: 'RESOLVED',
      };
      const putRes = await fetch(`${this.baseUrl}/api/receipt/${receiptId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatedPayload),
      });
      return putRes.ok;
    } catch {
      return false;
    }
  }

  /**
   * Uploads an external digital receipt (from Gmail / IMAP / Local Folder) into Receipt Wrangler
   * and returns the new Receipt Wrangler receipt ID and deep link URL.
   */
  public async uploadExternalReceipt(
    receipt: ReceiptMatch,
    transaction: SettledTransaction
  ): Promise<{ id: number; url: string } | null> {
    if (!this.baseUrl || !this.apiToken) return null;
    const headers = this.buildHeaders(true);
    try {
      const createPayload = {
        name: `${transaction.cleanName || transaction.rawName} (${transaction.date})`,
        amount: String(Math.abs(transaction.amount).toFixed(2)),
        date: new Date(`${transaction.date}T12:00:00Z`).toISOString(),
        groupId: this.groupId,
        paidByUserId: 1,
        status: 'RESOLVED',
        categories: [],
        tags: [],
        receiptItems: [],
        comments: [
          {
            comment: `Auto-synced from ${receipt.source} for Sure transaction ${transaction.id}`,
            userId: 1,
          },
        ],
        customFields: [],
      };

      const createRes = await fetch(`${this.baseUrl}/api/receipt`, {
        method: 'POST',
        headers,
        body: JSON.stringify(createPayload),
      });
      if (!createRes.ok) return null;

      const created = (await createRes.json()) as any;
      const newId = Number(created?.id);
      if (!newId) return null;

      // Upload image/PDF attachment to the created receipt
      if (receipt.fileBuffer && receipt.fileBuffer.length > 0) {
        const formData = new FormData();
        formData.append(
          'file',
          new Blob([receipt.fileBuffer], { type: receipt.mimeType }),
          receipt.fileName
        );
        formData.append('receiptId', String(newId));

        await fetch(`${this.baseUrl}/api/receiptImage`, {
          method: 'POST',
          headers: this.buildHeaders(false),
          body: formData,
        });
      }

      return {
        id: newId,
        url: this.getPublicReceiptUrl(newId),
      };
    } catch {
      return null;
    }
  }
}
