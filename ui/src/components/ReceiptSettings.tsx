import React, { useState } from 'react';
import { CompanionConfig, ReceiptsConfig, TestReceiptResponse } from '../types';
import { testReceipt } from '../api';
import {
  Receipt,
  Mail,
  FolderDown,
  PowerOff,
  Search,
  Save,
  Loader2,
  XCircle,
  X,
  FileCheck,
  Calendar,
  DollarSign,
  Tag
} from 'lucide-react';

interface Props {
  config: CompanionConfig;
  onSave: (patch: Partial<CompanionConfig>) => Promise<void>;
}

export const ReceiptSettings: React.FC<Props> = ({ config, onSave }) => {
  const receipts = config.receipts || { provider: 'disabled', lookbackDays: 3 };

  const [provider, setProvider] = useState<ReceiptsConfig['provider']>(
    receipts.provider || 'disabled'
  );
  const [lookbackDays, setLookbackDays] = useState<number>(receipts.lookbackDays || 3);

  // Gmail fields
  const [gmailCredentialsPath, setGmailCredentialsPath] = useState(
    receipts.gmail?.credentialsPath || ''
  );
  const [gmailClientId, setGmailClientId] = useState(receipts.gmail?.clientId || '');
  const [gmailClientSecret, setGmailClientSecret] = useState(receipts.gmail?.clientSecret || '');
  const [gmailRedirectUri, setGmailRedirectUri] = useState(receipts.gmail?.redirectUri || '');
  const [gmailRefreshToken, setGmailRefreshToken] = useState(receipts.gmail?.refreshToken || '');

  // IMAP fields
  const [imapHost, setImapHost] = useState(receipts.imap?.host || '');
  const [imapPort, setImapPort] = useState<number>(receipts.imap?.port || 993);
  const [imapSecure, setImapSecure] = useState(receipts.imap?.secure ?? true);
  const [imapUser, setImapUser] = useState(receipts.imap?.auth?.user || '');
  const [imapPass, setImapPass] = useState(receipts.imap?.auth?.pass || '');

  // Local folder fields
  const [localFolderPath, setLocalFolderPath] = useState(
    receipts.localFolder?.path || '/config/receipts_drop'
  );

  // Save states
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Test Modal states
  const [showTestModal, setShowTestModal] = useState(false);
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testAmount, setTestAmount] = useState('24.99');
  const [testRawName, setTestRawName] = useState('AMAZON.COM*2K3L5');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestReceiptResponse | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updatedReceipts: ReceiptsConfig = {
        provider,
        lookbackDays: Number(lookbackDays) || 3,
        gmail: {
          credentialsPath: gmailCredentialsPath || undefined,
          clientId: gmailClientId || undefined,
          clientSecret: gmailClientSecret || undefined,
          redirectUri: gmailRedirectUri || undefined,
          refreshToken: gmailRefreshToken || undefined
        },
        imap: {
          host: imapHost || undefined,
          port: Number(imapPort) || 993,
          secure: imapSecure,
          auth: {
            user: imapUser || undefined,
            pass: imapPass || undefined
          }
        },
        localFolder: {
          path: localFolderPath || '/config/receipts_drop'
        }
      };

      await onSave({ receipts: updatedReceipts });
      setSaveMessage('Receipt adapter settings saved successfully.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const runTestSearch = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testReceipt({
        date: testDate,
        amount: parseFloat(testAmount) || 0,
        rawName: testRawName
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        matched: false,
        error: err.message || 'Search test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/60 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Receipt Matcher & Ingestion</h2>
            <p className="text-sm text-slate-400">
              Configure automated receipt matching from email inboxes or local folders.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTestModal(true)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition"
        >
          <Search className="w-4 h-4 text-blue-400" />
          Test Search Query
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {/* Provider selector radio tabs */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Receipt Ingestion Adapter
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'disabled', label: 'Disabled', icon: PowerOff },
              { id: 'gmail', label: 'Gmail API', icon: Mail },
              { id: 'imap', label: 'IMAP Mailbox', icon: Mail },
              { id: 'local_folder', label: 'Local Folder', icon: FolderDown }
            ].map((p) => {
              const Icon = p.icon;
              const isSelected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id as ReceiptsConfig['provider'])}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1.5 transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 text-white font-medium'
                      : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="text-sm">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lookback Days */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" /> Search Lookback Window (Days)
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={lookbackDays}
            onChange={(e) => setLookbackDays(parseInt(e.target.value, 10) || 1)}
            className="w-32 px-4 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <p className="text-xs text-slate-400 mt-1">
            Days before and after the transaction date to scan for matching receipts.
          </p>
        </div>

        {/* Provider Specific Configuration */}
        {provider === 'gmail' && (
          <div className="p-4 bg-slate-900/70 border border-slate-700/80 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4" /> Gmail OAuth2 Credentials
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Credentials JSON File Path (Recommended)
              </label>
              <input
                type="text"
                value={gmailCredentialsPath}
                onChange={(e) => setGmailCredentialsPath(e.target.value)}
                placeholder="/config/gmail_credentials.json"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="text-xs text-slate-400 text-center">— OR Manual OAuth2 Tokens —</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Client ID</label>
                <input
                  type="text"
                  value={gmailClientId}
                  onChange={(e) => setGmailClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Client Secret</label>
                <input
                  type="password"
                  value={gmailClientSecret}
                  onChange={(e) => setGmailClientSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Redirect URI</label>
                <input
                  type="text"
                  value={gmailRedirectUri}
                  onChange={(e) => setGmailRedirectUri(e.target.value)}
                  placeholder="http://localhost:8045/oauth2callback"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Refresh Token</label>
                <input
                  type="password"
                  value={gmailRefreshToken}
                  onChange={(e) => setGmailRefreshToken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {provider === 'imap' && (
          <div className="p-4 bg-slate-900/70 border border-slate-700/80 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4" /> IMAP Mailbox Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">IMAP Host</label>
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.example.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
                <input
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(parseInt(e.target.value, 10) || 993)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="imapSecure"
                checked={imapSecure}
                onChange={(e) => setImapSecure(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <label htmlFor="imapSecure" className="text-xs text-slate-300">
                Use TLS / SSL (Port 993)
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username / Email</label>
                <input
                  type="text"
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password / App Password</label>
                <input
                  type="password"
                  value={imapPass}
                  onChange={(e) => setImapPass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {provider === 'local_folder' && (
          <div className="p-4 bg-slate-900/70 border border-slate-700/80 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <FolderDown className="w-4 h-4" /> Local Receipts Folder
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Drop Directory Path
              </label>
              <input
                type="text"
                value={localFolderPath}
                onChange={(e) => setLocalFolderPath(e.target.value)}
                placeholder="/config/receipts_drop"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Mounted directory inside container where PDFs or images are deposited.
              </p>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className="p-3 bg-blue-950/40 border border-blue-800 text-blue-300 text-sm rounded-lg">
            {saveMessage}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 shadow-lg shadow-blue-900/30 transition disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Receipt Settings
          </button>
        </div>
      </form>

      {/* Test Search Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setShowTestModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Test Receipt Search Query</h3>
                <p className="text-xs text-slate-400">
                  Simulate searching against your active adapter ({provider})
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Transaction Date
                </label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Settled Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Raw Merchant Name
                </label>
                <input
                  type="text"
                  value={testRawName}
                  onChange={(e) => setTestRawName(e.target.value)}
                  placeholder="e.g. AMAZON.COM*2K3L5"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-lg mb-5 border text-sm ${
                  testResult.matched
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : testResult.success
                    ? 'bg-slate-900/80 border-slate-700 text-slate-300'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                {testResult.matched ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-emerald-400">
                      <FileCheck className="w-4 h-4" /> Match Found!
                    </div>
                    <p className="text-xs text-slate-200">
                      File: <span className="font-mono">{testResult.match?.fileName}</span>
                    </p>
                    <p className="text-xs text-slate-300">
                      Source: {testResult.match?.source} | Mime: {testResult.match?.mimeType}
                    </p>
                    {testResult.match?.orderUrl && (
                      <p className="text-xs text-blue-400 truncate">
                        Link: {testResult.match.orderUrl}
                      </p>
                    )}
                  </div>
                ) : testResult.success ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <XCircle className="w-4 h-4" /> No matching receipt found for this query.
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span>{testResult.error}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={runTestSearch}
                disabled={isTesting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Run Test Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
