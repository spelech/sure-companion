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
  source: 'gmail' | 'imap' | 'local_folder' | 'receiptwrangler';
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
  engine: 'rule' | 'heuristic' | 'llm' | 'openai' | 'ollama';
  notes?: string;
  isReceiptRelevant?: boolean;
  reasoning?: string;
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

export interface TransactionUpdate {
  merchantId?: string;
  categoryId?: string;
  notes?: string;
  name?: string;
  date?: string;
  amount?: number;
  currency?: string;
  userModified?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface SyncError {
  transactionId?: string;
  error: string;
}

export interface SyncReport {
  totalFetched: number;
  skippedPending: number;
  skippedExcluded: number;
  skippedAlreadyProcessed: number;
  processedSettled: number;
  receiptsMatched: number;
  skippedReceiptTriage?: number;
  errors: SyncError[];
}

