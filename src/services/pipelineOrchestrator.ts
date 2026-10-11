import {
  SettledTransaction,
  TransactionUpdate,
  Category,
  ReceiptAdapter,
  CategorizationAdapter,
  CategorizationDecision,
  SyncError,
  SyncReport
} from '../types';
import { SureClient } from './sureClient';
import { StateStore } from './stateStore';
import { normalizeMerchant } from './normalizer';

export { SyncError, SyncReport };

export interface PipelineOptions {
  days?: number;
}

export class PipelineOrchestrator {
  private sureClient: SureClient;
  private stateStore: StateStore;
  private receiptAdapter?: ReceiptAdapter | null;
  private categorizer?: CategorizationAdapter | null;
  private defaultOptions: PipelineOptions;

  constructor(
    sureClient: SureClient,
    stateStore: StateStore,
    receiptAdapter?: ReceiptAdapter | null,
    categorizer?: CategorizationAdapter | null,
    options?: PipelineOptions
  ) {
    this.sureClient = sureClient;
    this.stateStore = stateStore;
    this.receiptAdapter = receiptAdapter;
    this.categorizer = categorizer;
    this.defaultOptions = {
      days: 14,
      ...options
    };
  }

  /**
   * Runs the sync pipeline:
   * 1. Fetches recent transactions from Sure.
   * 2. Filters through Settled-Only Gate:
   *    - Skips pending holds (pending === true)
   *    - Skips excluded transactions (excluded === true)
   *    - Skips already processed settled transactions (stateStore.isProcessed(tx.id, tx.amount))
   * 3. For settled un-enriched transactions:
   *    - Normalizes merchant name and resolves FamilyMerchant ID
   *    - Runs categorization against available categories
   *    - Searches for and attaches receipt (fault-tolerant with retry queue)
   *    - Updates transaction in Sure (user_modified: true)
   *    - Records processed record in state store
   */
  async runSync(options?: PipelineOptions): Promise<SyncReport> {
    const opts = { ...this.defaultOptions, ...options };
    const report: SyncReport = {
      totalFetched: 0,
      skippedPending: 0,
      skippedExcluded: 0,
      skippedAlreadyProcessed: 0,
      processedSettled: 0,
      receiptsMatched: 0,
      errors: []
    };

    let transactions: SettledTransaction[] = [];
    try {
      transactions = await this.sureClient.fetchTransactions(opts.days);
    } catch (err: any) {
      report.errors.push({ error: `Failed to fetch transactions from Sure: ${err?.message || String(err)}` });
      return report;
    }

    report.totalFetched = transactions.length;

    let categories: Category[] = [];
    if (this.sureClient && typeof this.sureClient.fetchCategories === 'function') {
      try {
        categories = (await this.sureClient.fetchCategories()) || [];
      } catch (err: any) {
        report.errors.push({ error: `Failed to fetch categories: ${err?.message || String(err)}` });
      }
    }
    const availableCategoryNames = categories.map((c) => c.name);

    for (const tx of transactions) {
      // 1. Settled-Only Gate: strictly skip pending holds!
      if (tx.pending) {
        report.skippedPending++;
        continue;
      }

      // 2. Excluded gate: skip excluded / duplicate entries
      if (tx.excluded) {
        report.skippedExcluded++;
        continue;
      }

      // 3. Processed check: skip already processed settled transactions
      if (this.stateStore.isProcessed(tx.id, tx.amount)) {
        report.skippedAlreadyProcessed++;
        continue;
      }

      try {
        // Step A: Normalizes merchant name and resolves FamilyMerchant ID
        const rawForNorm = tx.cleanName || tx.rawName;
        const normalized = normalizeMerchant(rawForNorm);
        const cleanName =
          normalized.cleanName && normalized.cleanName !== 'Unknown'
            ? normalized.cleanName
            : tx.cleanName || tx.rawName;

        let merchantId = tx.merchantId;
        if (cleanName && cleanName !== 'Unknown' && typeof this.sureClient.findOrCreateFamilyMerchant === 'function') {
          try {
            merchantId = await this.sureClient.findOrCreateFamilyMerchant(cleanName, normalized.websiteUrl);
          } catch (mErr: any) {
            report.errors.push({
              transactionId: tx.id,
              error: `Merchant resolution failed for '${cleanName}': ${mErr?.message || String(mErr)}`
            });
          }
        }

        // Step B: Categorization
        let categoryId = tx.categoryId;
        let categoryAssigned: string | null = null;
        if (this.categorizer && typeof this.categorizer.categorize === 'function') {
          try {
            const decision: CategorizationDecision | null = await this.categorizer.categorize(
              { ...tx, cleanName },
              availableCategoryNames
            );
            if (decision?.categoryName) {
              categoryAssigned = decision.categoryName;
              const matched = categories.find(
                (c) => c.name.toLowerCase() === decision.categoryName.toLowerCase()
              );
              if (matched) {
                categoryId = matched.id;
              }
            }
          } catch (cErr: any) {
            report.errors.push({
              transactionId: tx.id,
              error: `Categorization failed: ${cErr?.message || String(cErr)}`
            });
          }
        }

        // Step C: Receipt search & upload (fault tolerant)
        let receiptStatus = 'none';
        if (this.receiptAdapter && typeof this.receiptAdapter.findReceipt === 'function') {
          try {
            const receipt = await this.receiptAdapter.findReceipt({ ...tx, cleanName });
            if (receipt) {
              try {
                if (typeof this.sureClient.uploadAttachment === 'function') {
                  await this.sureClient.uploadAttachment(
                    tx.id,
                    receipt.fileBuffer,
                    receipt.fileName,
                    receipt.mimeType
                  );
                }
                receiptStatus = 'matched';
                report.receiptsMatched++;
              } catch (uploadErr: any) {
                receiptStatus = 'retry';
                report.errors.push({
                  transactionId: tx.id,
                  error: `Receipt upload failed: ${uploadErr?.message || String(uploadErr)}`
                });
                this.stateStore.enqueueRetry({
                  transactionId: tx.id,
                  taskType: 'receipt_upload',
                  payloadJson: JSON.stringify({
                    fileName: receipt.fileName,
                    mimeType: receipt.mimeType,
                    error: uploadErr?.message || String(uploadErr)
                  }),
                  attempts: 1,
                  nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                });
              }
            }
          } catch (findErr: any) {
            receiptStatus = 'retry';
            report.errors.push({
              transactionId: tx.id,
              error: `Receipt search failed: ${findErr?.message || String(findErr)}`
            });
            this.stateStore.enqueueRetry({
              transactionId: tx.id,
              taskType: 'receipt_fetch',
              payloadJson: JSON.stringify({
                error: findErr?.message || String(findErr)
              }),
              attempts: 1,
              nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });
          }
        }

        // Step D: Update transaction in Sure with user_modified: true lock
        const updates: Partial<TransactionUpdate> = {
          userModified: true
        };
        if (cleanName && cleanName !== 'Unknown') {
          updates.name = cleanName;
        }
        if (merchantId) {
          updates.merchantId = merchantId;
        }
        if (categoryId) {
          updates.categoryId = categoryId;
        }

        if (typeof this.sureClient.updateTransaction === 'function') {
          await this.sureClient.updateTransaction(tx.id, updates);
        }

        // Step E: Record processed in stateStore
        this.stateStore.recordProcessed({
          transactionId: tx.id,
          settledAmount: tx.amount,
          merchantAssigned: cleanName || merchantId || null,
          categoryAssigned: categoryAssigned || categoryId || null,
          receiptStatus
        });

        report.processedSettled++;
      } catch (txErr: any) {
        report.errors.push({
          transactionId: tx.id,
          error: `Transaction update failed: ${txErr?.message || String(txErr)}`
        });
      }
    }

    return report;
  }
}
