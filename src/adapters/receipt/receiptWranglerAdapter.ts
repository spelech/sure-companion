import { ReceiptAdapter, ReceiptMatch, SettledTransaction } from '../../types';

export interface ReceiptWranglerConfig {
  baseUrl?: string;
  apiToken?: string;
  groupId?: number;
  lookbackDays?: number;
}

export class ReceiptWranglerAdapter implements ReceiptAdapter {
  public readonly id = 'receiptwrangler';
  public readonly name = 'Receipt Wrangler';
  private readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly groupId: number;
  private readonly lookbackDays: number;

  constructor(config?: ReceiptWranglerConfig) {
    this.baseUrl = (config?.baseUrl || process.env.RECEIPTWRANGLER_BASE_URL || 'http://receiptwrangler:80').replace(/\/+$/, '');
    this.apiToken = config?.apiToken || process.env.RECEIPTWRANGLER_API_TOKEN;
    this.groupId = config?.groupId ?? 1;
    this.lookbackDays = config?.lookbackDays ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  public async findReceipt(transaction: SettledTransaction): Promise<ReceiptMatch | null> {
    if (!this.baseUrl) return null;

    const txDate = new Date(transaction.date);
    const minDate = new Date(txDate);
    minDate.setDate(minDate.getDate() - this.lookbackDays);
    const maxDate = new Date(txDate);
    maxDate.setDate(maxDate.getDate() + this.lookbackDays);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiToken) {
      headers['X-Api-Key'] = this.apiToken;
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    try {
      const searchUrl = `${this.baseUrl}/api/receipt/group/${this.groupId}`;
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page: 1,
          pageSize: 50,
          fullReceipts: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`ReceiptWrangler search failed with status ${response.status}`);
      }

      const resData = (await response.json()) as any;
      const receipts: any[] = resData.data || resData.receipts || (Array.isArray(resData) ? resData : []);

      const targetAmount = Math.abs(transaction.amount);

      // Find receipt matching amount and date range
      const match = receipts.find((r: any) => {
        const rAmount = Math.abs(Number(r.amount));
        const amountMatches = Math.abs(rAmount - targetAmount) < 0.01;
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
      const mimeType = dlResponse.headers.get('content-type') || 'image/jpeg';
      const fileName = imageFile.fileName || `receiptwrangler_${match.id || imageId}.jpg`;

      return {
        source: 'receiptwrangler',
        invoiceNumber: String(match.id || ''),
        orderUrl: `${this.baseUrl}/receipts/${match.id}`,
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
}
