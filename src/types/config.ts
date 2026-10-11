import { z } from 'zod';

export const SureConfigSchema = z.object({
  baseUrl: z.string().default('http://sure_web:3000'),
  apiToken: z.string(),
});

export const ReceiptsConfigSchema = z.object({
  provider: z.enum(['gmail', 'imap', 'local_folder', 'disabled']).default('disabled'),
  lookbackDays: z.number().int().positive().default(3),
  gmail: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
    refreshToken: z.string().optional(),
    credentialsPath: z.string().optional(),
  }).optional(),
  imap: z.object({
    host: z.string().optional(),
    port: z.number().int().optional(),
    secure: z.boolean().optional(),
    auth: z.object({
      user: z.string().optional(),
      pass: z.string().optional(),
    }).optional(),
  }).optional(),
  localFolder: z.object({
    path: z.string().default('/config/receipts_drop'),
  }).optional(),
});

export const CategorizationRuleSchema = z.object({
  pattern: z.string(),
  category: z.string(),
  cleanName: z.string().optional(),
});

export const CategorizationConfigSchema = z.object({
  provider: z.enum(['rules_only', 'ollama', 'openai', 'disabled']).default('rules_only'),
  rules: z.array(CategorizationRuleSchema).default([]),
  ollama: z.object({
    host: z.string().default('http://localhost:11434'),
    model: z.string().default('llama3.2'),
  }).optional(),
  openai: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gpt-4o-mini'),
    baseUrl: z.string().optional(),
  }).optional(),
});

export const SyncConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intervalMinutes: z.number().int().positive().default(60),
  lookbackDays: z.number().int().positive().default(14),
});

export const CompanionConfigSchema = z.object({
  sure: SureConfigSchema,
  receipts: ReceiptsConfigSchema.default({ provider: 'disabled' }),
  categorization: CategorizationConfigSchema.default({ provider: 'rules_only', rules: [] }),
  sync: SyncConfigSchema.default({ enabled: true, intervalMinutes: 60, lookbackDays: 14 }),
});

export type SureConfig = z.infer<typeof SureConfigSchema>;
export type ReceiptsConfig = z.infer<typeof ReceiptsConfigSchema>;
export type CategorizationRule = z.infer<typeof CategorizationRuleSchema>;
export type CategorizationConfig = z.infer<typeof CategorizationConfigSchema>;
export type SyncConfig = z.infer<typeof SyncConfigSchema>;
export type CompanionConfig = z.infer<typeof CompanionConfigSchema>;
export type CompanionConfigInput = z.input<typeof CompanionConfigSchema>;
