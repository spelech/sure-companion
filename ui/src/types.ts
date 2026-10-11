export interface SureConfig {
  baseUrl: string;
  apiToken: string;
}

export interface GmailConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  refreshToken?: string;
  credentialsPath?: string;
}

export interface ImapConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
}

export interface LocalFolderConfig {
  path: string;
}

export interface ReceiptWranglerConfig {
  baseUrl?: string;
  apiToken?: string;
  groupId?: number;
}

export interface ReceiptsConfig {
  provider: 'gmail' | 'imap' | 'local_folder' | 'receiptwrangler' | 'disabled';
  lookbackDays: number;
  selectiveMatching?: boolean;
  gmail?: GmailConfig;
  imap?: ImapConfig;
  localFolder?: LocalFolderConfig;
  receiptwrangler?: ReceiptWranglerConfig;
}

export interface CategorizationRule {
  pattern: string;
  category: string;
  cleanName?: string;
}

export interface OllamaConfig {
  host: string;
  model: string;
}

export interface OpenAiConfig {
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export interface CategorizationConfig {
  provider: 'rules_only' | 'ollama' | 'openai' | 'disabled';
  rules: CategorizationRule[];
  ollama?: OllamaConfig;
  openai?: OpenAiConfig;
}

export interface SyncConfig {
  intervalMinutes: number;
  lookbackDays: number;
}

export interface CompanionConfig {
  sure: SureConfig;
  receipts: ReceiptsConfig;
  categorization: CategorizationConfig;
  sync: SyncConfig;
}

export interface SyncReport {
  totalFetched: number;
  skippedPending: number;
  skippedExcluded: number;
  skippedAlreadyProcessed: number;
  processedSettled: number;
  receiptsMatched: number;
  errors: string[];
}

export interface CompanionStatus {
  latestReport: SyncReport | null;
  lastSyncTime: string | null;
  stats: {
    processedCount: number;
    pendingRetriesCount: number;
  };
  provider: string;
}

export interface TestSureResponse {
  success: boolean;
  message?: string;
  categoriesCount?: number;
  error?: string;
}

export interface TestReceiptResponse {
  success: boolean;
  matched: boolean;
  match?: {
    fileName: string;
    mimeType: string;
    source: string;
    receivedAt?: string;
    orderUrl?: string;
    invoiceNumber?: string;
  } | null;
  error?: string;
}

export interface TestCategorizationResponse {
  success: boolean;
  categoryName?: string;
  confidence?: number;
  isReceiptRelevant?: boolean;
  reasoning?: string;
  error?: string;
}
