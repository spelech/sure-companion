import React, { useState } from 'react';
import {
  CompanionConfig,
  CategorizationConfig,
  CategorizationRule,
  TestCategorizationResponse
} from '../types';
import { testCategorization } from '../api';
import {
  Sparkles,
  Cpu,
  Bot,
  Sliders,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Receipt,
  Calendar,
  DollarSign,
  Tag
} from 'lucide-react';

interface Props {
  config: CompanionConfig;
  onSave: (patch: Partial<CompanionConfig>) => Promise<void>;
}

export const CategorizationSettings: React.FC<Props> = ({ config, onSave }) => {
  const cat = config.categorization || { provider: 'rules_only', rules: [] };

  const [provider, setProvider] = useState<CategorizationConfig['provider']>(
    cat.provider || 'rules_only'
  );
  const [rules, setRules] = useState<CategorizationRule[]>(cat.rules || []);

  // Ollama fields
  const [ollamaHost, setOllamaHost] = useState(cat.ollama?.host || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(cat.ollama?.model || 'llama3.2');

  // OpenAI fields
  const [openaiKey, setOpenaiKey] = useState(cat.openai?.apiKey || '');
  const [openaiModel, setOpenaiModel] = useState(cat.openai?.model || 'gpt-4o-mini');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(cat.openai?.baseUrl || '');

  // New rule input state
  const [newPattern, setNewPattern] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newCleanName, setNewCleanName] = useState('');

  // Save states
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Test prompt state (Rules)
  const [testMerchant, setTestMerchant] = useState('TST* SWEETGREEN SOHO #102');
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    category?: string;
    cleanName?: string;
    matchedPattern?: string;
  } | null>(null);

  // Test state (AI / Triage)
  const [aiTestMerchant, setAiTestMerchant] = useState('AMAZON.COM*2K3L5');
  const [aiTestAmount, setAiTestAmount] = useState('49.99');
  const [aiTestDate, setAiTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<TestCategorizationResponse | null>(null);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim() || !newCategory.trim()) return;

    setRules([
      ...rules,
      {
        pattern: newPattern.trim(),
        category: newCategory.trim(),
        cleanName: newCleanName.trim() || undefined
      }
    ]);
    setNewPattern('');
    setNewCategory('');
    setNewCleanName('');
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updatedCat: CategorizationConfig = {
        provider,
        rules,
        ollama: {
          host: ollamaHost || 'http://localhost:11434',
          model: ollamaModel || 'llama3.2'
        },
        openai: {
          apiKey: openaiKey ? (openaiKey.includes('***') ? cat.openai?.apiKey : openaiKey) : undefined,
          model: openaiModel || 'gpt-4o-mini',
          baseUrl: openaiBaseUrl || undefined
        }
      };

      await onSave({ categorization: updatedCat });
      setSaveMessage('Categorization settings saved successfully.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Test prompt against current in-memory rules
  const handleTestMatch = () => {
    const raw = testMerchant.trim().toLowerCase();
    for (const rule of rules) {
      const pattern = rule.pattern.toLowerCase();
      // Test regex or substring match
      let isMatch = false;
      try {
        const rx = new RegExp(rule.pattern, 'i');
        isMatch = rx.test(testMerchant);
      } catch {
        isMatch = raw.includes(pattern);
      }

      if (isMatch) {
        setTestResult({
          matched: true,
          category: rule.category,
          cleanName: rule.cleanName || testMerchant,
          matchedPattern: rule.pattern
        });
        return;
      }
    }

    setTestResult({
      matched: false
    });
  };

  const applyPreset = (preset: 'openai' | 'litellm' | 'openrouter') => {
    if (preset === 'openai') {
      setOpenaiBaseUrl('https://api.openai.com/v1');
      setOpenaiModel('gpt-4o-mini');
    } else if (preset === 'litellm') {
      setOpenaiBaseUrl('http://localhost:4000/v1');
      setOpenaiModel('openai/gpt-4o-mini');
    } else if (preset === 'openrouter') {
      setOpenaiBaseUrl('https://openrouter.ai/api/v1');
      setOpenaiModel('anthropic/claude-3.5-sonnet');
    }
  };

  const handleTestAiTriage = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await testCategorization({
        rawName: aiTestMerchant,
        amount: parseFloat(aiTestAmount) || 0,
        date: aiTestDate
      });
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        error: err.message || 'AI triage test failed'
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/60 p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/60">
        <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Categorization & AI Models</h2>
          <p className="text-sm text-slate-400">
            Define deterministic regex rules and optional local or cloud LLM fallbacks.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider selector tabs */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Categorization Provider
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'rules_only', label: 'Deterministic Rules', icon: Sliders },
              { id: 'ollama', label: 'Ollama (Local LLM)', icon: Cpu },
              { id: 'openai', label: 'OpenAI API', icon: Bot },
              { id: 'disabled', label: 'Disabled', icon: HelpCircle }
            ].map((p) => {
              const Icon = p.icon;
              const isSelected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id as CategorizationConfig['provider'])}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1.5 transition ${
                    isSelected
                      ? 'border-purple-500 bg-purple-500/10 text-white font-medium'
                      : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-purple-400' : 'text-slate-500'}`} />
                  <span className="text-sm">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Model Settings */}
        {provider === 'ollama' && (
          <div className="p-4 bg-slate-900/70 border border-slate-700/80 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Ollama Local LLM Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ollama Host</label>
                <input
                  type="text"
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Model Name</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3.2"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {provider === 'openai' && (
          <div className="p-4 bg-slate-900/70 border border-slate-700/80 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4" /> OpenAI / Compatible API Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Model</label>
                <input
                  type="text"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Custom Base URL (Optional)
                </label>
                <input
                  type="text"
                  value={openaiBaseUrl}
                  onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-slate-400">Quick Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('openai')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition"
              >
                OpenAI Direct
              </button>
              <button
                type="button"
                onClick={() => applyPreset('litellm')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-purple-300 transition"
              >
                LiteLLM Proxy (localhost:4000)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('openrouter')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-blue-300 transition"
              >
                OpenRouter
              </button>
            </div>
          </div>
        )}

        {/* Deterministic Rules Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                Merchant Matching Rules ({rules.length})
              </h3>
              <p className="text-xs text-slate-400">
                Pattern-matched rules are evaluated before calling any AI models.
              </p>
            </div>
          </div>

          {/* Add Rule Form */}
          <div className="p-3 bg-slate-900/60 border border-slate-700/80 rounded-lg mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="Match Pattern (e.g. NETFLIX)"
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
              />
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Target Category (e.g. Entertainment)"
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
              />
              <input
                type="text"
                value={newCleanName}
                onChange={(e) => setNewCleanName(e.target.value)}
                placeholder="Clean Merchant (e.g. Netflix)"
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddRule}
                disabled={!newPattern.trim() || !newCategory.trim()}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>
          </div>

          {/* Rules Table */}
          {rules.length > 0 ? (
            <div className="overflow-x-auto border border-slate-700 rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Pattern</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Clean Merchant</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 bg-slate-800/40">
                  {rules.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30">
                      <td className="py-2 px-3 font-mono text-emerald-400 font-medium">
                        {rule.pattern}
                      </td>
                      <td className="py-2 px-3 text-slate-200">{rule.category}</td>
                      <td className="py-2 px-3 text-slate-400">{rule.cleanName || '—'}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(idx)}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-700 rounded-lg">
              No custom rules added yet. Add pattern matching rules above.
            </p>
          )}
        </div>

        {/* Live Rule & Prompt Tester */}
        <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-lg space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Test Matching against Transaction Name
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={testMerchant}
              onChange={(e) => setTestMerchant(e.target.value)}
              placeholder="e.g. TST* SWEETGREEN SOHO #102"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
            />
            <button
              type="button"
              onClick={handleTestMatch}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded"
            >
              Test Match
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded text-xs border ${
                testResult.matched
                  ? 'bg-purple-950/40 border-purple-800 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {testResult.matched ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Matched Pattern: &quot;{testResult.matchedPattern}&quot;
                  </div>
                  <div>
                    Category: <span className="font-semibold text-white">{testResult.category}</span> | Clean Merchant: <span className="text-white">{testResult.cleanName}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  No rule matched this merchant description.
                  {provider !== 'rules_only' && provider !== 'disabled'
                    ? ` Would fallback to ${provider} AI model.`
                    : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Categorization & Receipt Triage Tester */}
        <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" /> Test AI Categorization & Receipt Triage
            </h4>
            <span className="text-xs text-slate-400">
              Provider: <span className="font-mono text-purple-300">{provider}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Simulate how your active AI / rule model maps this transaction and whether it flags it for receipt retrieval.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Merchant / Description
              </label>
              <input
                type="text"
                value={aiTestMerchant}
                onChange={(e) => setAiTestMerchant(e.target.value)}
                placeholder="e.g. AMAZON.COM*2K3L5"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={aiTestAmount}
                onChange={(e) => setAiTestAmount(e.target.value)}
                placeholder="49.99"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                value={aiTestDate}
                onChange={(e) => setAiTestDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleTestAiTriage}
              disabled={isTestingAi || !aiTestMerchant.trim()}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {isTestingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bot className="w-3.5 h-3.5" />
              )}
              Test AI Triage
            </button>
          </div>

          {aiTestResult && (
            <div
              className={`p-3 rounded text-xs border ${
                aiTestResult.success
                  ? 'bg-slate-900/90 border-purple-800/80 text-slate-200'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {aiTestResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Category:</span>
                      <span className="font-semibold text-white px-2 py-0.5 bg-purple-900/50 border border-purple-700/60 rounded">
                        {aiTestResult.categoryName}
                      </span>
                      {aiTestResult.confidence !== undefined && (
                        <span className="text-[11px] text-slate-400">
                          ({Math.round(aiTestResult.confidence * 100)}% conf)
                        </span>
                      )}
                    </div>
                    <div>
                      {aiTestResult.isReceiptRelevant ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded font-medium">
                          <Receipt className="w-3 h-3" /> Receipt Expected (Will Search)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded">
                          Receipt Skipped (No digital receipt)
                        </span>
                      )}
                    </div>
                  </div>
                  {aiTestResult.reasoning && (
                    <p className="text-[11px] text-slate-400 italic border-t border-slate-800 pt-1.5">
                      <span className="font-medium text-slate-300">Reasoning:</span> {aiTestResult.reasoning}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{aiTestResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {saveMessage && (
          <div className="p-3 bg-purple-950/40 border border-purple-800 text-purple-300 text-sm rounded-lg">
            {saveMessage}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 shadow-lg shadow-purple-900/30 transition disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Categorization Settings
          </button>
        </div>
      </form>
    </div>
  );
};
