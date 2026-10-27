import { CategorizationAdapter, CategorizationDecision, SettledTransaction } from '../../types';
import { evaluateRule, Rule, DEFAULT_RULES } from '../../services/ruleEngine';

export class RuleCategorizer implements CategorizationAdapter {
  public readonly id = 'rule';
  private readonly rules: Rule[];

  constructor(customRules?: Rule[]) {
    // If custom rules are provided, prepend them to DEFAULT_RULES so custom rules take precedence
    this.rules = customRules && customRules.length > 0
      ? [...customRules, ...DEFAULT_RULES]
      : DEFAULT_RULES;
  }

  public isConfigured(): boolean {
    return true;
  }

  public async categorize(
    transaction: SettledTransaction,
    availableCategories: string[] = []
  ): Promise<CategorizationDecision | null> {
    const match = evaluateRule(
      transaction.rawName,
      transaction.cleanName,
      this.rules,
      transaction.amount
    );

    if (!match.matched || !match.category) {
      return null;
    }

    const resolvedCategory = match.category;
    const isReceiptRelevant = inferReceiptRelevance(resolvedCategory, transaction.rawName);

    // If availableCategories constraint is provided, ensure resolvedCategory is valid within it
    if (availableCategories.length > 0) {
      const exactMatch = availableCategories.find(
        (c) => c.toLowerCase() === resolvedCategory.toLowerCase()
      );
      if (!exactMatch) {
        return null;
      }
      return {
        categoryName: exactMatch,
        confidence: match.confidence ?? 1.0,
        engine: 'rule',
        isReceiptRelevant,
        notes: match.ruleId ? `Matched rule ${match.ruleId}` : undefined,
      };
    }

    return {
      categoryName: resolvedCategory,
      confidence: match.confidence ?? 1.0,
      engine: 'rule',
      isReceiptRelevant,
      notes: match.ruleId ? `Matched rule ${match.ruleId}` : undefined,
    };
  }
}

function inferReceiptRelevance(categoryName: string, rawText: string): boolean {
  const cat = categoryName.toLowerCase();
  const raw = rawText.toUpperCase();

  // Exclude transactions that almost never yield digital receipt emails
  if (
    cat.startsWith('transfer:') ||
    cat.startsWith('income:') ||
    cat.includes('payroll') ||
    cat.includes('internal liquidity') ||
    cat.includes('fast food & coffee') ||
    cat.includes('gasoline & fuel') ||
    cat.includes('tolls & transit') ||
    raw.includes('ATM ') ||
    raw.includes('WITHDRAWAL') ||
    raw.includes('AUTOPAY')
  ) {
    return false;
  }

  // Include categories typically generating invoices or purchase receipts (digital or paper)
  if (
    cat.includes('shopping') ||
    cat.includes('retail') ||
    cat.includes('groceries') ||
    cat.includes('restaurants') ||
    cat.includes('medical') ||
    cat.includes('electronics') ||
    cat.includes('software') ||
    cat.includes('subscriptions') ||
    cat.includes('home maintenance') ||
    cat.includes('travel') ||
    cat.includes('education & childcare') ||
    cat.includes('furnishings') ||
    cat.includes('pets')
  ) {
    return true;
  }

  return false;
}
