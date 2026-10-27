import React, { useState, useEffect } from 'react';
import { CompanionConfig, CompanionStatus } from '../types';
import {
  Activity,
  Play,
  Zap,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  Database,
  Layers,
  FileCheck2,
  AlertTriangle,
  Receipt,
  SkipForward,
  Timer,
  Save,
  ShieldAlert
} from 'lucide-react';

interface Props {
  status: CompanionStatus | null;
  config: CompanionConfig;
  isSyncing: boolean;
  onSync: (ignoreSettlementDelay?: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSaveConfig: (patch: Partial<CompanionConfig>) => Promise<void>;
}

export const ActivityLog: React.FC<Props> = ({
  status,
  config,
  isSyncing,
  onSync,
  onRefresh,
  onSaveConfig
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settlementDelayDays, setSettlementDelayDays] = useState<number>(
    config.sync?.settlementDelayDays ?? status?.settlementDelayDays ?? 5
  );
  const [intervalMinutes, setIntervalMinutes] = useState<number>(
    config.sync?.intervalMinutes ?? 60
  );
  const [lookbackDays, setLookbackDays] = useState<number>(
    config.sync?.lookbackDays ?? 14
  );
  const [isSavingDelay, setIsSavingDelay] = useState(false);

  useEffect(() => {
    setSettlementDelayDays(config.sync?.settlementDelayDays ?? status?.settlementDelayDays ?? 5);
    setIntervalMinutes(config.sync?.intervalMinutes ?? 60);
    setLookbackDays(config.sync?.lookbackDays ?? 14);
  }, [config.sync, status?.settlementDelayDays]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveDelaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDelay(true);
    try {
      await onSaveConfig({
        sync: {
          enabled: config.sync?.enabled ?? true,
          intervalMinutes: Math.max(1, Number(intervalMinutes) || 60),
          lookbackDays: Math.max(1, Number(lookbackDays) || 14),
          settlementDelayDays: Math.max(0, Number(settlementDelayDays) || 0)
        }
      });
    } finally {
      setIsSavingDelay(false);
    }
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'Never';
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  const report = status?.latestReport;
  const stats = status?.stats || { processedCount: 0, pendingRetriesCount: 0 };
  const activeDelay = config.sync?.settlementDelayDays ?? status?.settlementDelayDays ?? 5;

  return (
    <div className="space-y-6">
      {/* Header card with status and action buttons */}
      <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/60 p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl relative">
            <Activity className="w-7 h-7" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Pipeline Status & Activity</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isSyncing ? 'Syncing...' : 'Service Healthy'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {activeDelay}d Settlement Delay
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Last sync: <span className="text-slate-300">{formatTimestamp(status?.lastSyncTime)}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isSyncing}
            className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => onSync(false)}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition disabled:opacity-50"
            title={`Run standard sync respecting the ${activeDelay}-day settlement maturity window`}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Play className="w-4 h-4 text-emerald-400" />
            )}
            Sync Matured ({activeDelay}d+)
          </button>

          <button
            type="button"
            onClick={() => onSync(true)}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
            title="Bypass the settlement cooling period and immediately analyze, categorize, and link all settled transactions"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing Now...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                Sync Now (Override Delay)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Total Tracked</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.processedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Settled transactions in SQLite state</div>
        </div>

        <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Retry Queue</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.pendingRetriesCount}</div>
          <div className="text-xs text-slate-400 mt-1">Pending receipt rematch attempts</div>
        </div>

        <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Latest Processed</span>
            <CheckCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{report?.processedSettled ?? 0}</div>
          <div className="text-xs text-slate-400 mt-1">
            Settled in last run (fetched {report?.totalFetched ?? 0})
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold">Receipts Attached</span>
            <Receipt className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{report?.receiptsMatched ?? 0}</div>
          <div className="text-xs text-slate-400 mt-1">Matched & uploaded in last run</div>
        </div>
      </div>

      {/* Configurable Settlement Delay & Sync Schedule Panel */}
      <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-400" />
              Settlement Maturity Delay & Sync Schedule
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Wait a configurable number of days before enriching new transactions so restaurant tips, split shipments, and paper receipts settle cleanly. Use &quot;Sync Now (Override Delay)&quot; above to process immediately at any time.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveDelaySettings} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Settlement Delay (Days)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={settlementDelayDays}
              onChange={(e) => setSettlementDelayDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Lookback Window (Days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Math.max(1, parseInt(e.target.value, 10) || 14))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Auto-Sync Interval (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={1440}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Math.max(5, parseInt(e.target.value, 10) || 60))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSavingDelay}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isSavingDelay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Delay & Schedule
            </button>
          </div>
        </form>
      </div>

      {/* Latest Run Detailed Breakdown */}
      <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-emerald-400" />
          Latest Sync Breakdown
        </h3>

        {report ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Total Fetched</div>
                  <div className="text-lg font-semibold text-white mt-0.5">
                    {report.totalFetched}
                  </div>
                </div>
                <div className="p-2 bg-slate-800 rounded text-slate-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Skipped (Cooling Delay)</div>
                  <div className="text-lg font-semibold text-blue-400 mt-0.5">
                    {report.skippedCoolingPeriod ?? 0}
                  </div>
                </div>
                <div className="p-2 bg-blue-500/10 rounded text-blue-400">
                  <Timer className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Skipped (Pending Hold)</div>
                  <div className="text-lg font-semibold text-amber-400 mt-0.5">
                    {report.skippedPending}
                  </div>
                </div>
                <div className="p-2 bg-amber-500/10 rounded text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Suppressed Pre-Tip Holds</div>
                  <div className="text-lg font-semibold text-emerald-400 mt-0.5">
                    {report.suppressedHolds ?? 0}
                  </div>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded text-emerald-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Skipped (Excluded/Seen)</div>
                  <div className="text-lg font-semibold text-slate-300 mt-0.5">
                    {report.skippedExcluded + report.skippedAlreadyProcessed}
                  </div>
                </div>
                <div className="p-2 bg-slate-800 rounded text-slate-400">
                  <SkipForward className="w-4 h-4" />
                </div>
              </div>
            </div>

            {report.errors && report.errors.length > 0 && (
              <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm mb-2">
                  <AlertTriangle className="w-4 h-4" /> Sync Warnings / Errors ({report.errors.length})
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-rose-200/90 font-mono">
                  {report.errors.map((err, i) => (
                    <li key={i}>
                      {typeof err === 'string'
                        ? err
                        : `${err.transactionId ? `[${err.transactionId}] ` : ''}${err.error}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-lg">
            <p className="text-sm">No sync execution report recorded yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Click &quot;Sync Now (Override Delay)&quot; or &quot;Sync Matured&quot; above to trigger an orchestrator run.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
