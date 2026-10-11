import React, { useState } from 'react';
import { CompanionConfig, TestSureResponse } from '../types';
import { testSure } from '../api';
import { CheckCircle2, XCircle, Loader2, Save, Link2, KeyRound, Globe } from 'lucide-react';

interface Props {
  config: CompanionConfig;
  onSave: (patch: Partial<CompanionConfig>) => Promise<void>;
}

export const SureSettings: React.FC<Props> = ({ config, onSave }) => {
  const [baseUrl, setBaseUrl] = useState(config.sure?.baseUrl || 'http://sure_web:3000');
  const [apiToken, setApiToken] = useState(config.sure?.apiToken || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestSureResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // If token is masked ('***') and user didn't change it, send empty string to let backend use current token
      const tokenToSend = apiToken.includes('***') ? undefined : apiToken;
      const res = await testSure(baseUrl, tokenToSend);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Connection test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const patch: Partial<CompanionConfig> = {
        sure: {
          baseUrl,
          // Only send token if user updated it from masked representation
          apiToken: apiToken.includes('***') ? config.sure.apiToken : apiToken
        }
      };
      await onSave(patch);
      setSaveMessage('Sure connection settings saved successfully.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/60 p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/60">
        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
          <Link2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Sure Instance Connection</h2>
          <p className="text-sm text-slate-400">
            Configure the API connection to your primary Sure personal finance web instance.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" /> Sure Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://sure_web:3000"
            className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
            required
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Internal Docker network address (e.g. <code className="text-emerald-400">http://sure_web:3000</code>) or external URL.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-400" /> API Token
          </label>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Paste your Sure Bearer API Token"
            className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            The bearer token generated from Sure Settings &gt; API Tokens. Existing tokens are masked.
          </p>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 border ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              <p className="font-semibold">
                {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
              </p>
              <p className="mt-0.5 opacity-90">
                {testResult.success
                  ? `${testResult.message || 'Connected to Sure API'}. Discovered ${
                      testResult.categoriesCount ?? 0
                    } categories.`
                  : testResult.error}
              </p>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className="p-3 bg-blue-950/40 border border-blue-800 text-blue-300 text-sm rounded-lg">
            {saveMessage}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || (!apiToken && !config.sure?.apiToken)}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Test Connection
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};
