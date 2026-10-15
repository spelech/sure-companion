import { CategorizationAdapter, CategorizationDecision, SettledTransaction } from '../../types';

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAICategorizer implements CategorizationAdapter {
  public readonly id = 'openai';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config?: OpenAIConfig) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    this.model = config?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.baseUrl = config?.baseUrl || process.env.OPENAI_BASE_URL || 'http://localhost:4000/v1';
  }

  public isConfigured(): boolean {
    // LiteLLM or local proxy might not require an apiKey; OpenRouter or OpenAI does
    return Boolean(this.baseUrl && this.model);
  }

  public async categorize(
    transaction: SettledTransaction,
    availableCategories: string[] = []
  ): Promise<CategorizationDecision | null> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const categoryListText = availableCategories.length > 0
      ? availableCategories.map((c) => `- ${c}`).join('\n')
      : 'None provided. Propose an appropriate standard personal finance category.';

    const systemPrompt = `You are an expert personal finance classification and audit triage assistant.
Given a settled banking transaction and a list of available categories from the user's financial system:
1. Select the single most appropriate category name from the provided Available Categories.
2. Determine whether this transaction is expected to have a digital receipt or itemized purchase invoice (isReceiptRelevant).
   - High relevance (true): E-commerce/online shopping (Amazon, Apple, Best Buy), flight/hotel bookings, electronics, home improvement materials, software subscriptions, professional services.
   - Low relevance (false): ATM cash withdrawals, gas stations, drive-through coffee, fast food, road tolls, parking meters, internal transfers, peer-to-peer transfers (Zelle/Venmo), payroll, credit card payments.
3. Provide a confidence score between 0.0 and 1.0.

Respond ONLY with a valid JSON object matching this schema:
{
  "categoryName": "string",
  "isReceiptRelevant": boolean,
  "confidence": number,
  "reasoning": "string"
}`;

    const userPrompt = `Available Categories:
${categoryListText}

Transaction Details:
- Date: ${transaction.date}
- Amount: ${transaction.amount}
- Raw Description: "${transaction.rawName}"
- Cleaned Merchant: "${transaction.cleanName || transaction.rawName}"`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI/LiteLLM error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      let resolvedCategory = String(parsed.categoryName || '').trim();

      // If availableCategories was supplied, validate match
      if (availableCategories.length > 0) {
        const exact = availableCategories.find(
          (c) => c.toLowerCase() === resolvedCategory.toLowerCase()
        );
        if (exact) {
          resolvedCategory = exact;
        }
      }

      return {
        categoryName: resolvedCategory || 'General & Miscellaneous',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        engine: 'openai',
        isReceiptRelevant: Boolean(parsed.isReceiptRelevant),
        notes: parsed.reasoning,
        reasoning: parsed.reasoning,
      };
    } catch (err: any) {
      console.warn(`[OpenAICategorizer] Failed to triage transaction ${transaction.id}: ${err.message}`);
      return null;
    }
  }
}
