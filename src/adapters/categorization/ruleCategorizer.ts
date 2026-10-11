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
        notes: match.ruleId ? `Matched rule ${match.ruleId}` : undefined,
      };
    }

    return {
      categoryName: resolvedCategory,
      confidence: match.confidence ?? 1.0,
      engine: 'rule',
      notes: match.ruleId ? `Matched rule ${match.ruleId}` : undefined,
    };
  }
}
