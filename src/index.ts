#!/usr/bin/env node
import { startServer, buildServer, ServerOptions, StartServerOptions } from './server/app';
import { ConfigManager } from './server/configManager';
import { StateStore } from './services/stateStore';
import { SureClient } from './services/sureClient';
import { PipelineOrchestrator } from './services/pipelineOrchestrator';

export * from './types';
export {
  buildServer,
  startServer,
  ConfigManager,
  StateStore,
  SureClient,
  PipelineOrchestrator,
  ServerOptions,
  StartServerOptions
};

// Standalone execution entrypoint
if (require.main === module || (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js')))) {
  startServer()
    .then(({ app }) => {
      const shutdown = async (signal: string) => {
        app.log.info(`Received ${signal}, cleanly shutting down...`);
        try {
          await app.close();
          process.exit(0);
        } catch (err) {
          app.log.error({ err }, 'Error during shutdown');
          process.exit(1);
        }
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    })
    .catch((err) => {
      console.error('Fatal initialization error:', err);
      process.exit(1);
    });
}
