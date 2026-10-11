import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchConfig,
  updateConfig,
  fetchStatus,
  runSync
} from './api';
import { CompanionConfig, CompanionStatus } from './types';
import { SureSettings } from './components/SureSettings';
import { ReceiptSettings } from './components/ReceiptSettings';
import { CategorizationSettings } from './components/CategorizationSettings';
import { ActivityLog } from './components/ActivityLog';
import {
  Activity,
  Link2,
  Receipt,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Coins
} from 'lucide-react';

type Tab = 'activity' | 'sure' | 'receipts' | 'categorization';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [config, setConfig] = useState<CompanionConfig | null>(null);
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const [conf, stat] = await Promise.all([
        fetchConfig(),
        fetchStatus().catch(() => null)
      ]);
      setConfig(conf);
      if (stat) setStatus(stat);
      setGlobalError(null);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to load configuration from Sure Companion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll status every 15 seconds
    const interval = setInterval(async () => {
      try {
        const s = await fetchStatus();
        setStatus(s);
      } catch {
        // quiet background poll error
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

  const handleSave = async (patch: Partial<CompanionConfig>) => {
    try {
      const updated = await updateConfig(patch);
      setConfig(updated);
      showToast('Settings saved successfully!');
    } catch (err: any) {
      showToast(`Save failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await runSync();
      const updatedStatus = await fetchStatus().catch(() => null);
      if (updatedStatus) {
        setStatus(updatedStatus);
      } else if (result.report) {
        setStatus((prev) => ({
          latestReport: result.report,
          lastSyncTime: new Date().toISOString(),
          stats: prev?.stats || { processedCount: 0, pendingRetriesCount: 0 },
          provider: prev?.provider || 'disabled'
        }));
      }
      showToast(
        `Sync completed: ${result.report.processedSettled} settled processed, ${result.report.receiptsMatched} receipts attached.`
      );
    } catch (err: any) {
      showToast(`Sync failed: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const stat = await fetchStatus();
      setStatus(stat);
      showToast('Status refreshed');
    } catch (err: any) {
      showToast(`Refresh failed: ${err.message}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm font-medium">Connecting to Sure Companion API...</p>
      </div>
    );
  }

  if (globalError && !config) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 border border-rose-800/80 rounded-xl p-6 max-w-md text-center shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Backend Connection Error</h2>
          <p className="text-sm text-slate-300 mb-4">{globalError}</p>
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'activity', label: 'Overview & Activity', icon: Activity },
    { id: 'sure', label: 'Sure Instance', icon: Link2 },
    { id: 'receipts', label: 'Receipt Adapter', icon: Receipt },
    { id: 'categorization', label: 'Categorization & AI', icon: Sparkles }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/90 border-rose-700 text-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 rounded-lg shadow-md shadow-emerald-900/40">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  Sure Companion
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-mono">
                    v0.1.0
                  </span>
                </h1>
                <p className="text-xs text-slate-400">Microservice Pipeline & Setup</p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                Adapter: <span className="text-emerald-400 font-semibold">{status?.provider || config?.receipts.provider || 'disabled'}</span>
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-800/60 overflow-x-auto py-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-500 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {config && (
          <>
            {activeTab === 'activity' && (
              <ActivityLog
                status={status}
                isSyncing={isSyncing}
                onSync={handleSync}
                onRefresh={handleRefresh}
              />
            )}

            {activeTab === 'sure' && (
              <SureSettings config={config} onSave={handleSave} />
            )}

            {activeTab === 'receipts' && (
              <ReceiptSettings config={config} onSave={handleSave} />
            )}

            {activeTab === 'categorization' && (
              <CategorizationSettings config={config} onSave={handleSave} />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Sure Companion &bull; Personal Finance Microservice Pipeline
      </footer>
    </div>
  );
};

export default App;
