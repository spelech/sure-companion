import React from 'react';
import { CompanionStatus } from '../types';
import {
  Activity,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  Database,
  Layers,
  FileCheck2,
  AlertTriangle,
  Receipt,
  SkipForward
} from 'lucide-react';

interface Props {
  status: CompanionStatus | null;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const ActivityLog: React.FC<Props> = ({
  status,
  isSyncing,
  onSync,
  onRefresh
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
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

  return (
    <div className="space-y-6">
      {/* Header card with status and action buttons */}
      <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/60 p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl relative">
            <Activity className="w-7 h-7" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Pipeline Status & Activity</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isSyncing ? 'Syncing...' : 'Service Healthy'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Last sync: <span className="text-slate-300">{formatTimestamp(status?.lastSyncTime)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isSyncing}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing Now...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Sync Now
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

      {/* Latest Run Detailed Breakdown */}
      <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-emerald-400" />
          Latest Sync Breakdown
        </h3>

        {report ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Total Transactions Fetched</div>
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
                  <div className="text-xs text-slate-400">Skipped (Pending Sync)</div>
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
                  <div className="text-xs text-slate-400">Skipped (Excluded or Seen)</div>
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
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-lg">
            <p className="text-sm">No sync execution report recorded yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Click &quot;Sync Now&quot; above to trigger an immediate orchestrator run.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
