import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { ConfigManager } from './configManager';
import { healthRoutes } from './routes/healthRoutes';
import { apiRoutes } from './routes/apiRoutes';
import { StateStore } from '../services/stateStore';
import { SureClient } from '../services/sureClient';
import { ReceiptAdapter, SyncReport } from '../types';
import { PipelineOrchestrator } from '../services/pipelineOrchestrator';

export interface ServerOptions {
  configDir?: string;
  configManager?: ConfigManager;
  stateDbPath?: string;
  stateStore?: StateStore;
  sureClient?: SureClient;
  receiptAdapter?: ReceiptAdapter;
  orchestrator?: PipelineOrchestrator;
  publicDir?: string;
  logger?: boolean | object;
}

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false
  });

  // CORS Hook
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });

  // Static assets serving (for setup UI if build artifacts exist)
  const candidateDirs = [
    options.publicDir,
    path.resolve(process.cwd(), 'dist/public'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public'),
    path.resolve(__dirname, '../../dist/public')
  ].filter(Boolean) as string[];

  const staticDir = candidateDirs.find((dir) => fs.existsSync(dir));
  if (staticDir) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/'
    });

    app.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || '';
      if (!url.startsWith('/api') && !url.startsWith('/health')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: 'Not Found', message: `Route ${req.method}:${req.url} not found` });
    });
  }

  // Register Health Routes (/health)
  await app.register(healthRoutes);

  // Initialize ConfigManager and StateStore
  const configManager = options.configManager || new ConfigManager(options.configDir);
  const stateDbPath =
    options.stateDbPath ||
    process.env.STATE_DB_PATH ||
    path.join(configManager.getConfigDir(), 'companion_state.db');

  const stateStore = options.stateStore || new StateStore(stateDbPath);

  // Cleanly close StateStore on server shutdown
  app.addHook('onClose', async () => {
    try {
      stateStore.close();
    } catch (err) {
      app.log.warn({ err }, 'Error closing StateStore on server shutdown');
    }
  });

  // App context for storing latest runtime sync stats
  const appContext: {
    latestReport?: SyncReport | null;
    lastSyncTime?: string | null;
  } = {
    latestReport: null,
    lastSyncTime: null
  };

  // Register API Routes (/api/...)
  await app.register(apiRoutes, {
    prefix: '/api',
    configManager,
    stateStore,
    sureClient: options.sureClient,
    receiptAdapter: options.receiptAdapter,
    orchestrator: options.orchestrator,
    appContext
  });

  return app;
}

export function startPeriodicSync(
  app: FastifyInstance,
  configManager: ConfigManager
): NodeJS.Timeout | null {
  const config = configManager.getConfig();
  if (!config.sync?.enabled) {
    app.log.info('Periodic sync is disabled');
    return null;
  }

  const intervalMinutes = config.sync?.intervalMinutes || 60;
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  app.log.info(`Scheduling background sync every ${intervalMinutes} minute(s)`);

  const timer = setInterval(async () => {
    try {
      const currentConfig = configManager.getConfig();
      if (!currentConfig.sync?.enabled) {
        return;
      }
      app.log.info('Triggering periodic scheduled sync...');
      const res = await app.inject({ method: 'POST', url: '/api/sync/run' });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        app.log.info('Periodic scheduled sync run completed successfully');
      } else {
        app.log.warn(`Periodic scheduled sync run returned status ${res.statusCode}: ${res.body}`);
      }
    } catch (err) {
      app.log.error({ err }, 'Error executing periodic scheduled sync');
    }
  }, intervalMs);

  timer.unref();

  try {
    app.addHook('onClose', async () => {
      clearInterval(timer);
    });
  } catch {
    // If instance is already started/ready, addHook cannot be called
  }

  return timer;
}

export interface StartServerOptions extends ServerOptions {
  port?: number;
  host?: string;
}

export async function startServer(options: StartServerOptions = {}): Promise<{
  app: FastifyInstance;
  syncTimer: NodeJS.Timeout | null;
  address: string;
}> {
  const port = options.port ?? parseInt(process.env.PORT || '8045', 10);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';

  const configManager = options.configManager || new ConfigManager(options.configDir);
  const app = await buildServer({
    logger: options.logger ?? true,
    configManager,
    ...options
  });

  const syncTimer = startPeriodicSync(app, configManager);

  const address = await app.listen({ port, host });
  app.log.info(`Sure Companion server listening on ${address}`);

  return { app, syncTimer, address };
}

// Start standalone server when executed directly
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('app.ts'))) {
  startServer().catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}
