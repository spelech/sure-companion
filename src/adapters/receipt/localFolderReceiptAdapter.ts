import fs from 'fs';
import path from 'path';
import { ReceiptAdapter, ReceiptMatch, SettledTransaction } from '../../types';

export interface LocalFolderConfig {
  path?: string;
  lookbackDays?: number;
}

export class LocalFolderReceiptAdapter implements ReceiptAdapter {
  public readonly id = 'local_folder';
  public readonly name = 'Local Folder Dropper';
  private readonly folderPath: string;
  private readonly lookbackDays: number;

  constructor(config?: LocalFolderConfig) {
    this.folderPath = config?.path || process.env.LOCAL_RECEIPTS_PATH || '/config/receipts_drop';
    this.lookbackDays = config?.lookbackDays ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.folderPath);
  }

  public async findReceipt(transaction: SettledTransaction): Promise<ReceiptMatch | null> {
    if (!fs.existsSync(this.folderPath)) {
      return null;
    }

    const txDate = new Date(transaction.date);
    const absAmount = Math.abs(transaction.amount);
    const amountStr = absAmount.toFixed(2); // e.g. "145.20"
    const amountNoDot = amountStr.replace('.', ''); // e.g. "14520"

    const minDate = new Date(txDate);
    minDate.setDate(minDate.getDate() - this.lookbackDays);
    const maxDate = new Date(txDate);
    maxDate.setDate(maxDate.getDate() + this.lookbackDays);

    const files = fs.readdirSync(this.folderPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        continue;
      }

      const filePath = path.join(this.folderPath, file);
      const stat = fs.statSync(filePath);

      // Check date proximity via file mtime or filename date token
      const fileDate = stat.mtime;
      const isDateClose = fileDate >= minDate && fileDate <= maxDate;

      // Check if amount is present in filename (e.g., "receipt_145.20_amazon.pdf" or "145.20.pdf")
      const nameUpper = file.toUpperCase();
      const hasAmountInName = nameUpper.includes(amountStr) || nameUpper.includes(amountNoDot);

      if (hasAmountInName && isDateClose) {
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = ext === '.pdf' ? 'application/pdf' : `image/${ext.replace('.', '').replace('jpg', 'jpeg')}`;

        return {
          source: 'local_folder',
          fileName: file,
          mimeType,
          fileBuffer,
          receivedAt: stat.mtime.toISOString(),
        };
      }
    }

    return null;
  }
}
