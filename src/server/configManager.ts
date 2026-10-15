import fs from 'fs';
import path from 'path';
import {
  CompanionConfig,
  CompanionConfigInput,
  CompanionConfigSchema
} from '../types/config';

export const MASKED_SECRET = '********';

export function isMasked(value?: string | null): boolean {
  if (!value) return false;
  return value.includes('***') || value === MASKED_SECRET;
}

export function maskSecret(value?: string | null): string | undefined {
  if (!value) return value === '' ? '' : undefined;
  if (value.length <= 8) return MASKED_SECRET;
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

export class ConfigManager {
  private configDir: string;
  private configFilePath: string;
  private config: CompanionConfig;

  constructor(configDir?: string) {
    const defaultDir = fs.existsSync('/config') ? '/config' : path.resolve(process.cwd(), 'config');
    this.configDir = configDir || process.env.CONFIG_DIR || defaultDir;
    this.configFilePath = path.join(this.configDir, 'config.json');
    this.config = this.loadConfig();
  }

  public getConfigFilePath(): string {
    return this.configFilePath;
  }

  public getConfigDir(): string {
    return this.configDir;
  }

  public getConfig(): CompanionConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public getSanitizedConfig(): CompanionConfig {
    const raw = this.getConfig();

    // Mask secrets
    if (raw.sure?.apiToken) {
      raw.sure.apiToken = maskSecret(raw.sure.apiToken) || '';
    }
    if (raw.receipts?.gmail?.clientSecret) {
      raw.receipts.gmail.clientSecret = maskSecret(raw.receipts.gmail.clientSecret);
    }
    if (raw.receipts?.gmail?.refreshToken) {
      raw.receipts.gmail.refreshToken = maskSecret(raw.receipts.gmail.refreshToken);
    }
    if (raw.receipts?.imap?.auth?.pass) {
      raw.receipts.imap.auth.pass = maskSecret(raw.receipts.imap.auth.pass);
    }
    if (raw.receipts?.receiptwrangler?.apiToken) {
      raw.receipts.receiptwrangler.apiToken = maskSecret(raw.receipts.receiptwrangler.apiToken);
    }
    if (raw.categorization?.openai?.apiKey) {
      raw.categorization.openai.apiKey = maskSecret(raw.categorization.openai.apiKey);
    }

    return raw;
  }

  public async updateConfig(updates: Record<string, any>): Promise<CompanionConfig> {
    const current = this.getConfig();

    // Preserve existing secrets if the update contains masked values or omitted values
    const mergedSure = {
      ...current.sure,
      ...(updates.sure || {})
    };
    if (isMasked(updates.sure?.apiToken)) {
      mergedSure.apiToken = current.sure.apiToken;
    }

    const mergedReceiptsGmail = {
      ...(current.receipts?.gmail || {}),
      ...(updates.receipts?.gmail || {})
    };
    if (isMasked(updates.receipts?.gmail?.clientSecret)) {
      mergedReceiptsGmail.clientSecret = current.receipts?.gmail?.clientSecret;
    }
    if (isMasked(updates.receipts?.gmail?.refreshToken)) {
      mergedReceiptsGmail.refreshToken = current.receipts?.gmail?.refreshToken;
    }

    const mergedReceiptsImapAuth = {
      ...(current.receipts?.imap?.auth || {}),
      ...(updates.receipts?.imap?.auth || {})
    };
    if (isMasked(updates.receipts?.imap?.auth?.pass)) {
      mergedReceiptsImapAuth.pass = current.receipts?.imap?.auth?.pass;
    }

    const mergedReceiptsImap = {
      ...(current.receipts?.imap || {}),
      ...(updates.receipts?.imap || {}),
      ...(Object.keys(mergedReceiptsImapAuth).length > 0 ? { auth: mergedReceiptsImapAuth } : {})
    };

    const mergedReceiptsWrangler = {
      ...(current.receipts?.receiptwrangler || {}),
      ...(updates.receipts?.receiptwrangler || {})
    };
    if (isMasked(updates.receipts?.receiptwrangler?.apiToken)) {
      mergedReceiptsWrangler.apiToken = current.receipts?.receiptwrangler?.apiToken;
    }

    const mergedReceipts = {
      ...current.receipts,
      ...(updates.receipts || {}),
      ...(current.receipts?.gmail || updates.receipts?.gmail ? { gmail: mergedReceiptsGmail } : {}),
      ...(current.receipts?.imap || updates.receipts?.imap ? { imap: mergedReceiptsImap } : {}),
      ...(current.receipts?.receiptwrangler || updates.receipts?.receiptwrangler
        ? { receiptwrangler: mergedReceiptsWrangler }
        : {})
    };

    const mergedCategorizationOpenai = {
      ...(current.categorization?.openai || {}),
      ...(updates.categorization?.openai || {})
    };
    if (isMasked(updates.categorization?.openai?.apiKey)) {
      mergedCategorizationOpenai.apiKey = current.categorization?.openai?.apiKey;
    }

    const mergedCategorization = {
      ...current.categorization,
      ...(updates.categorization || {}),
      ...(current.categorization?.openai || updates.categorization?.openai
        ? { openai: mergedCategorizationOpenai }
        : {})
    };

    const mergedSync = {
      ...current.sync,
      ...(updates.sync || {})
    };

    const candidate = {
      sure: mergedSure,
      receipts: mergedReceipts,
      categorization: mergedCategorization,
      sync: mergedSync
    };

    const parsed = CompanionConfigSchema.parse(candidate);
    this.config = parsed;
    await this.saveConfig();
    return this.getConfig();
  }

  public async saveConfig(): Promise<void> {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  private loadConfig(): CompanionConfig {
    let fileConfig: any = {};
    if (fs.existsSync(this.configFilePath)) {
      try {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        fileConfig = JSON.parse(raw);
      } catch (err) {
        console.warn(`Failed to parse ${this.configFilePath}, falling back to defaults/env:`, err);
      }
    }

    const delayEnv = process.env.SYNC_SETTLEMENT_DELAY_DAYS ?? process.env.SETTLEMENT_DELAY_DAYS;

    // Merge env variables
    const envConfig: any = {
      sure: {
        baseUrl: process.env.SURE_BASE_URL,
        apiToken: process.env.SURE_API_TOKEN
      },
      receipts: {
        provider: process.env.RECEIPTS_PROVIDER,
        lookbackDays: process.env.RECEIPTS_LOOKBACK_DAYS ? parseInt(process.env.RECEIPTS_LOOKBACK_DAYS, 10) : undefined,
        gmail: {
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          redirectUri: process.env.GMAIL_REDIRECT_URI,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          credentialsPath: process.env.GMAIL_CREDENTIALS_PATH
        },
        imap: {
          host: process.env.IMAP_HOST,
          port: process.env.IMAP_PORT ? parseInt(process.env.IMAP_PORT, 10) : undefined,
          secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE === 'true' : undefined,
          auth: {
            user: process.env.IMAP_USER,
            pass: process.env.IMAP_PASS
          }
        },
        localFolder: {
          path: process.env.LOCAL_FOLDER_PATH
        },
        receiptwrangler: {
          baseUrl: process.env.RECEIPTWRANGLER_BASE_URL,
          publicUrl: process.env.RECEIPTWRANGLER_PUBLIC_URL,
          apiToken: process.env.RECEIPTWRANGLER_API_TOKEN,
          groupId: process.env.RECEIPTWRANGLER_GROUP_ID
            ? parseInt(process.env.RECEIPTWRANGLER_GROUP_ID, 10)
            : undefined
        }
      },
      categorization: {
        provider: process.env.CATEGORIZATION_PROVIDER,
        ollama: {
          host: process.env.OLLAMA_HOST,
          model: process.env.OLLAMA_MODEL
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL,
          baseUrl: process.env.OPENAI_BASE_URL
        }
      },
      sync: {
        enabled: process.env.SYNC_ENABLED !== undefined ? process.env.SYNC_ENABLED === 'true' : undefined,
        intervalMinutes: process.env.SYNC_INTERVAL_MINUTES
          ? parseInt(process.env.SYNC_INTERVAL_MINUTES, 10)
          : undefined,
        lookbackDays: process.env.SYNC_LOOKBACK_DAYS
          ? parseInt(process.env.SYNC_LOOKBACK_DAYS, 10)
          : undefined,
        settlementDelayDays: delayEnv !== undefined
          ? parseInt(delayEnv, 10)
          : undefined
      }
    };

    // Clean undefined keys
    const cleanObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj;
      const res: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cleaned = typeof value === 'object' ? cleanObject(value) : value;
          if (typeof cleaned !== 'object' || (cleaned && Object.keys(cleaned).length > 0)) {
            res[key] = cleaned;
          }
        }
      }
      return res;
    };

    const cleanedEnv = cleanObject(envConfig);

    const merged = {
      sure: {
        baseUrl: 'http://sure_web:3000',
        apiToken: '',
        ...(fileConfig.sure || {}),
        ...(cleanedEnv.sure || {})
      },
      receipts: {
        provider: 'disabled',
        lookbackDays: 3,
        ...(fileConfig.receipts || {}),
        ...(cleanedEnv.receipts || {}),
        ...(fileConfig.receipts?.gmail || cleanedEnv.receipts?.gmail
          ? { gmail: { ...(fileConfig.receipts?.gmail || {}), ...(cleanedEnv.receipts?.gmail || {}) } }
          : {}),
        ...(fileConfig.receipts?.imap || cleanedEnv.receipts?.imap
          ? { imap: { ...(fileConfig.receipts?.imap || {}), ...(cleanedEnv.receipts?.imap || {}) } }
          : {}),
        ...(fileConfig.receipts?.localFolder || cleanedEnv.receipts?.localFolder
          ? { localFolder: { ...(fileConfig.receipts?.localFolder || {}), ...(cleanedEnv.receipts?.localFolder || {}) } }
          : {}),
        ...(fileConfig.receipts?.receiptwrangler || cleanedEnv.receipts?.receiptwrangler
          ? {
              receiptwrangler: {
                ...(fileConfig.receipts?.receiptwrangler || {}),
                ...(cleanedEnv.receipts?.receiptwrangler || {})
              }
            }
          : {})
      },
      categorization: {
        provider: 'rules_only',
        rules: [],
        ...(fileConfig.categorization || {}),
        ...(cleanedEnv.categorization || {}),
        ...(fileConfig.categorization?.ollama || cleanedEnv.receipts?.ollama
          ? { ollama: { ...(fileConfig.categorization?.ollama || {}), ...(cleanedEnv.categorization?.ollama || {}) } }
          : {}),
        ...(fileConfig.categorization?.openai || cleanedEnv.categorization?.openai
          ? { openai: { ...(fileConfig.categorization?.openai || {}), ...(cleanedEnv.categorization?.openai || {}) } }
          : {})
      },
      sync: {
        enabled: true,
        intervalMinutes: 60,
        lookbackDays: 14,
        settlementDelayDays: 5,
        ...(fileConfig.sync || {}),
        ...(cleanedEnv.sync || {})
      }
    };

    const parsed = CompanionConfigSchema.safeParse(merged);
    if (parsed.success) {
      return parsed.data;
    } else {
      // In case of any validation quirks, return best effort or defaults
      return {
        sure: {
          baseUrl: merged.sure.baseUrl || 'http://sure_web:3000',
          apiToken: merged.sure.apiToken || ''
        },
        receipts: {
          provider: 'disabled',
          lookbackDays: 3,
          selectiveMatching: true
        },
        categorization: {
          provider: 'rules_only',
          rules: []
        },
        sync: {
          enabled: true,
          intervalMinutes: 60,
          lookbackDays: 14,
          settlementDelayDays: 5
        }
      };
    }
  }
}
