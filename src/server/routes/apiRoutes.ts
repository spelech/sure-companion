import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ConfigManager } from '../configManager';
import { SureClient } from '../../services/sureClient';
import { StateStore } from '../../services/stateStore';
import { ReceiptAdapter, CategorizationAdapter, SettledTransaction, SyncReport } from '../../types';
import { PipelineOrchestrator } from '../../services/pipelineOrchestrator';
import { RuleCategorizer } from '../../adapters/categorization/ruleCategorizer';
import { OpenAICategorizer } from '../../adapters/categorization/openaiCategorizer';
import { NullReceiptAdapter } from '../../adapters/receipt/nullReceiptAdapter';
import { GmailReceiptAdapter } from '../../adapters/receipt/gmailReceiptAdapter';
import { LocalFolderReceiptAdapter } from '../../adapters/receipt/localFolderReceiptAdapter';
import { ReceiptWranglerAdapter } from '../../adapters/receipt/receiptWranglerAdapter';

export interface ApiRoutesOptions extends FastifyPluginOptions {
  configManager: ConfigManager;
  sureClient?: SureClient;
  stateStore?: StateStore;
  receiptAdapter?: ReceiptAdapter;
  orchestrator?: PipelineOrchestrator;
  appContext?: {
    latestReport?: SyncReport | null;
    lastSyncTime?: string | null;
  };
}

export async function apiRoutes(
  fastify: FastifyInstance,
  opts: ApiRoutesOptions
): Promise<void> {
  const { configManager } = opts;
  const appContext = opts.appContext || {
    latestReport: null,
    lastSyncTime: null
  };

  // Helper to get or build SureClient
  const getSureClient = (overrideUrl?: string, overrideToken?: string): SureClient => {
    if (opts.sureClient) {
      return opts.sureClient;
    }
    const config = configManager.getConfig();
    const baseUrl = overrideUrl || config.sure?.baseUrl || 'http://sure_web:3000';
    const apiToken = overrideToken || config.sure?.apiToken || '';
    return new SureClient(baseUrl, apiToken);
  };

  // Helper to get or build ReceiptAdapter
  const getReceiptAdapter = (): ReceiptAdapter => {
    if (opts.receiptAdapter) {
      return opts.receiptAdapter;
    }
    const config = configManager.getConfig();
    if (config.receipts?.provider === 'gmail' && config.receipts?.gmail) {
      const g = config.receipts.gmail;
      return new GmailReceiptAdapter({
        clientId: g.clientId,
        clientSecret: g.clientSecret,
        redirectUri: g.redirectUri,
        refreshToken: g.refreshToken,
        credentialsPath: g.credentialsPath,
        lookbackDays: config.receipts.lookbackDays
      });
    }
    if (config.receipts?.provider === 'local_folder') {
      return new LocalFolderReceiptAdapter({
        path: config.receipts.localFolder?.path,
        lookbackDays: config.receipts.lookbackDays
      });
    }
    if (config.receipts?.provider === 'receiptwrangler' && config.receipts?.receiptwrangler) {
      const rw = config.receipts.receiptwrangler;
      return new ReceiptWranglerAdapter({
        baseUrl: rw.baseUrl,
        apiToken: rw.apiToken,
        groupId: rw.groupId,
        lookbackDays: config.receipts.lookbackDays
      });
    }
    return new NullReceiptAdapter();
  };

  // Helper to get or build StateStore
  const getStateStore = (): StateStore => {
    if (opts.stateStore) {
      return opts.stateStore;
    }
    return new StateStore(':memory:');
  };

  // Helper to get or build PipelineOrchestrator
  const getOrchestrator = (): PipelineOrchestrator => {
    if (opts.orchestrator) {
      return opts.orchestrator;
    }
    const client = getSureClient();
    const store = getStateStore();
    const adapter = getReceiptAdapter();
    const config = configManager.getConfig();

    let categorizer: CategorizationAdapter;
    if (config.categorization?.provider === 'openai' && config.categorization?.openai) {
      categorizer = new OpenAICategorizer({
        baseUrl: config.categorization.openai.baseUrl,
        apiKey: config.categorization.openai.apiKey,
        model: config.categorization.openai.model,
      });
    } else {
      const mappedRules = (config.categorization?.rules || []).map((r) => ({
        pattern: r.pattern,
        targetCategory: r.category,
        targetMerchant: r.cleanName
      }));
      categorizer = new RuleCategorizer(mappedRules);
    }

    return new PipelineOrchestrator(client, store, adapter, categorizer, {
      days: config.sync?.lookbackDays || 14,
      selectiveReceiptMatching: config.receipts?.selectiveMatching ?? true,
    });
  };

  // GET /api/config: returns sanitized config (with masked secrets)
  fastify.get('/config', async () => {
    return configManager.getSanitizedConfig();
  });

  // PATCH /api/config: updates config and persists to disk
  fastify.patch('/config', async (req, reply) => {
    try {
      const body = req.body as Record<string, any>;
      if (!body || typeof body !== 'object') {
        return reply.status(400).send({ error: 'Request body must be a JSON object' });
      }
      const updated = await configManager.updateConfig(body);
      return configManager.getSanitizedConfig();
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Invalid configuration',
        message: err?.message || String(err),
        issues: err?.issues
      });
    }
  });

  // POST /api/test/sure: tests connection to Sure with provided URL & token
  fastify.post('/test/sure', async (req, reply) => {
    const body = (req.body as { baseUrl?: string; apiToken?: string }) || {};
    const config = configManager.getConfig();
    const baseUrl = body.baseUrl || config.sure?.baseUrl;
    const apiToken = body.apiToken || config.sure?.apiToken;

    if (!apiToken) {
      return reply.status(400).send({
        success: false,
        error: 'Sure API token is required'
      });
    }

    try {
      const client = getSureClient(body.baseUrl, body.apiToken);
      const categories = await client.fetchCategories();
      return {
        success: true,
        message: 'Successfully connected to Sure API',
        categoriesCount: categories.length
      };
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // POST /api/test/receipt: tests receipt adapter search with sample date & amount
  fastify.post('/test/receipt', async (req, reply) => {
    const body = (req.body as { date?: string; amount?: number; rawName?: string }) || {};
    const adapter = getReceiptAdapter();

    const sampleTx: SettledTransaction = {
      id: 'test-tx',
      date: body.date || new Date().toISOString().split('T')[0],
      amount: typeof body.amount === 'number' ? body.amount : 10.0,
      rawName: body.rawName || 'Sample Store',
      pending: false,
      excluded: false
    };

    try {
      const match = await adapter.findReceipt(sampleTx);
      if (match) {
        return {
          success: true,
          matched: true,
          match: {
            fileName: match.fileName,
            mimeType: match.mimeType,
            source: match.source,
            receivedAt: match.receivedAt,
            orderUrl: match.orderUrl,
            invoiceNumber: match.invoiceNumber
          }
        };
      }
      return {
        success: true,
        matched: false,
        match: null
      };
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // POST /api/test/categorization: tests AI categorization and triage with sample transaction
  fastify.post('/test/categorization', async (req, reply) => {
    const body = (req.body as {
      rawName?: string;
      amount?: number;
      date?: string;
      availableCategories?: string[];
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    }) || {};

    const config = configManager.getConfig();
    const categorizer = new OpenAICategorizer({
      baseUrl: body.baseUrl || config.categorization?.openai?.baseUrl,
      apiKey: body.apiKey || config.categorization?.openai?.apiKey,
      model: body.model || config.categorization?.openai?.model,
    });

    const sampleTx: SettledTransaction = {
      id: 'test-categorization-tx',
      date: body.date || new Date().toISOString().split('T')[0],
      amount: typeof body.amount === 'number' ? body.amount : 45.0,
      rawName: body.rawName || 'AMAZON.COM*2K4L1M9 SEATTLE WA',
      cleanName: 'Amazon',
      pending: false,
      excluded: false
    };

    const categories = body.availableCategories || [
      'Groceries & Supermarket',
      'Shopping: General Retail & Household',
      'Utilities: Electric',
      'Dining Out: Fast Food & Coffee'
    ];

    try {
      const decision = await categorizer.categorize(sampleTx, categories);
      return {
        success: Boolean(decision),
        decision,
      };
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // POST /api/sync/run: triggers an immediate pipeline sync run
  fastify.post('/sync/run', async (req, reply) => {
    try {
      const orchestrator = getOrchestrator();
      const report = await orchestrator.runSync();
      appContext.latestReport = report;
      appContext.lastSyncTime = new Date().toISOString();
      return {
        success: true,
        report
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // GET /api/status: returns latest sync report and state store summary
  fastify.get('/status', async () => {
    const store = getStateStore();
    const config = configManager.getConfig();
    const stats = typeof store.getStats === 'function'
      ? store.getStats()
      : { processedCount: 0, pendingRetriesCount: 0 };

    return {
      latestReport: appContext.latestReport || null,
      lastSyncTime: appContext.lastSyncTime || null,
      stats,
      provider: config.receipts?.provider || 'disabled'
    };
  });
}
