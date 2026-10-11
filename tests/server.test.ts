import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { buildServer, startPeriodicSync } from '../src/server/app';
import { ConfigManager } from '../src/server/configManager';
import { StateStore } from '../src/services/stateStore';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';

describe('Server API', () => {
  const testConfigDir = path.resolve(__dirname, './test_server_config');
  let app: FastifyInstance;

  beforeAll(async () => {
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testConfigDir, { recursive: true });

    // Seed test config
    const initialConfig = {
      sure: {
        baseUrl: 'http://sure_test:3000',
        apiToken: 'super-secret-token-12345'
      },
      receipts: {
        provider: 'disabled',
        lookbackDays: 5
      },
      categorization: {
        provider: 'rules_only',
        rules: [
          { pattern: 'NETFLIX', category: 'Entertainment' }
        ]
      },
      sync: {
        intervalMinutes: 30,
        lookbackDays: 7
      }
    };
    fs.writeFileSync(path.join(testConfigDir, 'config.json'), JSON.stringify(initialConfig, null, 2));

    app = await buildServer({
      configDir: testConfigDir,
      stateDbPath: ':memory:',
      logger: false
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('Health Route', () => {
    it('responds with 200 on /health', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(typeof body.uptime).toBe('number');
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('Config API', () => {
    it('GET /api/config returns sanitized configuration with masked secrets', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/config' });
      expect(res.statusCode).toBe(200);
      const config = JSON.parse(res.body);
      expect(config.sure.baseUrl).toBe('http://sure_test:3000');
      // Token should be masked
      expect(config.sure.apiToken).not.toBe('super-secret-token-12345');
      expect(config.sure.apiToken).toContain('***');
    });

    it('PATCH /api/config updates configuration and persists to disk', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/config',
        payload: {
          sync: {
            intervalMinutes: 15,
            lookbackDays: 10
          },
          categorization: {
            provider: 'rules_only',
            rules: [
              { pattern: 'SPOTIFY', category: 'Music' }
            ]
          }
        }
      });

      expect(patchRes.statusCode).toBe(200);
      const updated = JSON.parse(patchRes.body);
      expect(updated.sync.intervalMinutes).toBe(15);
      expect(updated.sync.lookbackDays).toBe(10);
      expect(updated.categorization.rules).toEqual([
        { pattern: 'SPOTIFY', category: 'Music' }
      ]);

      // Check on-disk persistence
      const onDisk = JSON.parse(fs.readFileSync(path.join(testConfigDir, 'config.json'), 'utf-8'));
      expect(onDisk.sync.intervalMinutes).toBe(15);
      // Original secret should be preserved on disk
      expect(onDisk.sure.apiToken).toBe('super-secret-token-12345');
    });

    it('PATCH /api/config returns 400 on invalid input', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/config',
        payload: {
          sync: {
            intervalMinutes: -5 // invalid negative interval
          }
        }
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
    });
  });

  describe('Test Endpoints', () => {
    it('POST /api/test/sure verifies connection with Sure API', async () => {
      // Create a test server with a mocked SureClient
      const mockSureClient = {
        fetchCategories: vi.fn().mockResolvedValue([
          { id: 'cat-1', name: 'Groceries' },
          { id: 'cat-2', name: 'Utilities' }
        ])
      };

      const testApp = await buildServer({
        configDir: testConfigDir,
        stateDbPath: ':memory:',
        sureClient: mockSureClient as any,
        logger: false
      });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'POST',
        url: '/api/test/sure',
        payload: {
          baseUrl: 'http://custom-sure:3000',
          apiToken: 'custom-token'
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.categoriesCount).toBe(2);

      await testApp.close();
    });

    it('POST /api/test/receipt searches for matching receipt', async () => {
      const mockReceiptAdapter = {
        id: 'gmail',
        name: 'Gmail',
        isConfigured: () => true,
        findReceipt: vi.fn().mockResolvedValue({
          source: 'gmail',
          fileName: 'receipt_target.pdf',
          mimeType: 'application/pdf',
          fileBuffer: Buffer.from('fake-pdf'),
          receivedAt: '2026-10-10T12:00:00Z'
        })
      };

      const testApp = await buildServer({
        configDir: testConfigDir,
        stateDbPath: ':memory:',
        receiptAdapter: mockReceiptAdapter as any,
        logger: false
      });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'POST',
        url: '/api/test/receipt',
        payload: {
          date: '2026-10-10',
          amount: 42.50,
          rawName: 'TARGET STORE #123'
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.matched).toBe(true);
      expect(body.match.fileName).toBe('receipt_target.pdf');

      await testApp.close();
    });
  });

  describe('Sync and Status Endpoints', () => {
    it('POST /api/sync/run triggers pipeline sync and returns report', async () => {
      const mockReport = {
        totalFetched: 5,
        skippedPending: 1,
        skippedExcluded: 0,
        skippedAlreadyProcessed: 1,
        processedSettled: 3,
        receiptsMatched: 2,
        errors: []
      };

      const mockOrchestrator = {
        runSync: vi.fn().mockResolvedValue(mockReport)
      };

      const testApp = await buildServer({
        configDir: testConfigDir,
        stateDbPath: ':memory:',
        orchestrator: mockOrchestrator as any,
        logger: false
      });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'POST',
        url: '/api/sync/run'
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.report).toEqual(mockReport);
      expect(mockOrchestrator.runSync).toHaveBeenCalled();

      // Check GET /api/status returns the latest report
      const statusRes = await testApp.inject({
        method: 'GET',
        url: '/api/status'
      });
      expect(statusRes.statusCode).toBe(200);
      const statusBody = JSON.parse(statusRes.body);
      expect(statusBody.latestReport).toEqual(mockReport);
      expect(statusBody.lastSyncTime).toBeDefined();

      await testApp.close();
    });
  });

  describe('CORS and Headers', () => {
    it('sets CORS headers on requests and handles OPTIONS preflight', async () => {
      const optionsRes = await app.inject({
        method: 'OPTIONS',
        url: '/api/config',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'PATCH'
        }
      });

      expect(optionsRes.statusCode).toBe(204);
      expect(optionsRes.headers['access-control-allow-origin']).toBe('*');
      expect(optionsRes.headers['access-control-allow-methods']).toContain('PATCH');
    });
  });

  describe('Static file serving and edge cases', () => {
    it('POST /api/test/sure returns 400 when apiToken is missing', async () => {
      const emptyConfigDir = path.resolve(__dirname, './empty_config_test');
      fs.mkdirSync(emptyConfigDir, { recursive: true });
      fs.writeFileSync(path.join(emptyConfigDir, 'config.json'), JSON.stringify({ sure: { baseUrl: 'http://foo', apiToken: '' } }));

      const testApp = await buildServer({
        configDir: emptyConfigDir,
        stateDbPath: ':memory:',
        logger: false
      });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'POST',
        url: '/api/test/sure',
        payload: {
          apiToken: ''
        }
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('Sure API token is required');

      await testApp.close();
      fs.rmSync(emptyConfigDir, { recursive: true, force: true });
    });

    it('POST /api/test/receipt returns matched: false when no receipt found', async () => {
      const mockReceiptAdapter = {
        id: 'disabled',
        name: 'Disabled',
        isConfigured: () => false,
        findReceipt: vi.fn().mockResolvedValue(null)
      };

      const testApp = await buildServer({
        configDir: testConfigDir,
        stateDbPath: ':memory:',
        receiptAdapter: mockReceiptAdapter as any,
        logger: false
      });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'POST',
        url: '/api/test/receipt',
        payload: {
          date: '2026-10-10',
          amount: 50.00
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.matched).toBe(false);
      expect(body.match).toBeNull();

      await testApp.close();
    });

    it('serves static files if publicDir exists', async () => {
      const tempPublicDir = path.resolve(__dirname, './temp_public_test');
      fs.mkdirSync(tempPublicDir, { recursive: true });
      fs.writeFileSync(path.join(tempPublicDir, 'index.html'), '<h1>Sure Companion UI</h1>');

      const testApp = await buildServer({
        configDir: testConfigDir,
        stateDbPath: ':memory:',
        publicDir: tempPublicDir,
        logger: false
      });
      await testApp.ready();

      const res = await testApp.inject({
        method: 'GET',
        url: '/index.html'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<h1>Sure Companion UI</h1>');

      // Test GET / returns index.html
      const rootRes = await testApp.inject({
        method: 'GET',
        url: '/'
      });
      expect(rootRes.statusCode).toBe(200);
      expect(rootRes.body).toContain('<h1>Sure Companion UI</h1>');

      // Test SPA fallback returns index.html for client route
      const spaRes = await testApp.inject({
        method: 'GET',
        url: '/activity'
      });
      expect(spaRes.statusCode).toBe(200);
      expect(spaRes.body).toContain('<h1>Sure Companion UI</h1>');

      // Test non-existent API route still returns 404
      const api404Res = await testApp.inject({
        method: 'GET',
        url: '/api/does_not_exist'
      });
      expect(api404Res.statusCode).toBe(404);

      await testApp.close();
      fs.rmSync(tempPublicDir, { recursive: true, force: true });
    });

    it('serves built static assets from dist/public if present', async () => {
      const distPublic = path.resolve(__dirname, '../dist/public');
      if (fs.existsSync(path.join(distPublic, 'index.html'))) {
        const testApp = await buildServer({
          configDir: testConfigDir,
          stateDbPath: ':memory:',
          publicDir: distPublic,
          logger: false
        });
        await testApp.ready();

        const res = await testApp.inject({
          method: 'GET',
          url: '/'
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('Sure Companion');
        expect(res.body).toContain('id="root"');

        await testApp.close();
      }
    });

    it('loads configuration defaults with environment variable fallbacks', async () => {
      process.env.SURE_BASE_URL = 'http://env-sure:3000';
      process.env.SURE_API_TOKEN = 'env-secret-token';
      process.env.RECEIPTS_PROVIDER = 'local_folder';

      const tempDir = path.resolve(__dirname, './temp_env_config');
      const mgr = new ConfigManager(tempDir);
      const conf = mgr.getConfig();

      expect(conf.sure.baseUrl).toBe('http://env-sure:3000');
      expect(conf.sure.apiToken).toBe('env-secret-token');
      expect(conf.receipts.provider).toBe('local_folder');

      delete process.env.SURE_BASE_URL;
      delete process.env.SURE_API_TOKEN;
      delete process.env.RECEIPTS_PROVIDER;

      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('cleans up StateStore database handle on server close', async () => {
      const customStore = new StateStore(':memory:');
      const closeSpy = vi.spyOn(customStore, 'close');

      const lifecycleApp = await buildServer({
        configDir: testConfigDir,
        stateStore: customStore,
        logger: false
      });
      await lifecycleApp.ready();

      expect(closeSpy).not.toHaveBeenCalled();
      await lifecycleApp.close();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('wires periodic background sync timer according to sync configuration', async () => {
      const tempDir = path.resolve(__dirname, './temp_sync_timer_config');
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });

      // 1. When sync is enabled
      const enabledConfig = {
        sure: { baseUrl: 'http://test:3000', apiToken: 'token' },
        sync: { enabled: true, intervalMinutes: 15 }
      };
      fs.writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify(enabledConfig));
      const mgrEnabled = new ConfigManager(tempDir);

      const serverEnabled = await buildServer({
        configManager: mgrEnabled,
        stateDbPath: ':memory:',
        logger: false
      });
      const timer = startPeriodicSync(serverEnabled, mgrEnabled);
      expect(timer).not.toBeNull();
      await serverEnabled.ready();

      await serverEnabled.close();

      // 2. When sync is disabled
      const disabledConfig = {
        sure: { baseUrl: 'http://test:3000', apiToken: 'token' },
        sync: { enabled: false, intervalMinutes: 15 }
      };
      fs.writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify(disabledConfig));
      const mgrDisabled = new ConfigManager(tempDir);

      const serverDisabled = await buildServer({
        configManager: mgrDisabled,
        stateDbPath: ':memory:',
        logger: false
      });
      const timerDisabled = startPeriodicSync(serverDisabled, mgrDisabled);
      expect(timerDisabled).toBeNull();
      await serverDisabled.ready();

      await serverDisabled.close();

      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
