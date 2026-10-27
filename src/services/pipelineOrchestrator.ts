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
import { ReceiptWranglerAdapter } from '../adapters/receipt/receiptWranglerAdapter';

export { SyncError, SyncReport };

export interface PipelineOptions {
  days?: number;
  selectiveReceiptMatching?: boolean;
  settlementDelayDays?: number;
  ignoreSettlementDelay?: boolean;
  referenceDate?: Date | string;
  receiptWranglerLinker?: ReceiptWranglerAdapter | null;
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
      selectiveReceiptMatching: true,
      settlementDelayDays: 0,
      ignoreSettlementDelay: false,
      ...options
    };
  }

  /**
   * Detects and suppresses pre-tip authorization holds that have been superseded
   * by a settled post-tip transaction on the same merchant within 3 days.
   */
  private async suppressSupersededHolds(
    transactions: SettledTransaction[],
    report: SyncReport
  ): Promise<void> {
    const NON_TIP_RETAIL_PATTERNS = /amazon|amzn|target|walmart|costco|meijer|jewel|aldi|whole foods|mariano|apple|google|netflix|spotify|hulu|disney|chewy|best buy|home depot|menards|lowes|comed|nicor|xfinity|comcast|verizon|at&t/i;

    const candidates = transactions.filter((t) => !t.pending && !t.excluded && t.amount > 0);
    for (const holdTx of candidates) {
      if (
        holdTx.excluded ||
        (holdTx.userModified && holdTx.categoryId) ||
        this.stateStore.isProcessed(holdTx.id, holdTx.amount)
      ) {
        continue;
      }
      const holdNorm = normalizeMerchant(holdTx.cleanName || holdTx.rawName).cleanName;
      const holdKey = (holdNorm && holdNorm !== 'Unknown' ? holdNorm : holdTx.rawName).toLowerCase();
      if (NON_TIP_RETAIL_PATTERNS.test(holdKey) || NON_TIP_RETAIL_PATTERNS.test(holdTx.rawName)) {
        continue;
      }
      const holdTime = new Date(holdTx.date.includes('T') ? holdTx.date : `${holdTx.date}T00:00:00Z`).getTime();

      const settledMatch = candidates.find((settledTx) => {
        if (settledTx.id === holdTx.id || settledTx.excluded) return false;
        if (holdTx.accountId && settledTx.accountId && holdTx.accountId !== settledTx.accountId) {
          return false;
        }
        const settledNorm = normalizeMerchant(settledTx.cleanName || settledTx.rawName).cleanName;
        const settledKey = (settledNorm && settledNorm !== 'Unknown' ? settledNorm : settledTx.rawName).toLowerCase();
        if (holdKey !== settledKey) return false;

        const settledTime = new Date(settledTx.date.includes('T') ? settledTx.date : `${settledTx.date}T00:00:00Z`).getTime();
        const diffDays = (settledTime - holdTime) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 3) return false;

        // Pre-tip hold is smaller than settled post-tip charge (typical 8% to 45% tip)
        const ratio = settledTx.amount / holdTx.amount;
        return ratio >= 1.08 && ratio <= 1.45;
      });

      if (settledMatch) {
        try {
          holdTx.excluded = true;
          if (typeof this.sureClient.updateTransaction === 'function') {
            await this.sureClient.updateTransaction(holdTx.id, {
              excluded: true,
              userModified: true,
              notes: `Auto-excluded: Superseded by settled post-tip charge ($${settledMatch.amount.toFixed(2)} on ${settledMatch.date})`
            });
          }
          this.stateStore.recordProcessed({
            transactionId: holdTx.id,
            settledAmount: holdTx.amount,
            merchantAssigned: holdNorm || null,
            categoryAssigned: 'Excluded: Pre-Tip Hold',
            receiptStatus: 'none'
          });
          report.suppressedHolds = (report.suppressedHolds || 0) + 1;
        } catch (err: any) {
          report.errors.push({
            transactionId: holdTx.id,
            error: `Failed to suppress pre-tip hold: ${err?.message || String(err)}`
          });
        }
      }
    }
  }

  /**
   * Runs the sync pipeline:
   * 1. Fetches recent transactions from Sure.
   * 2. Suppresses superseded pre-tip authorization holds.
   * 3. Filters through Settled-Only & Maturity Gates:
   *    - Skips pending holds (pending === true)
   *    - Skips excluded transactions (excluded === true)
   *    - Skips already processed settled transactions (stateStore.isProcessed(tx.id, tx.amount))
   *    - Skips transactions inside the configurable settlement delay window (unless ignoreSettlementDelay is true)
   * 4. For settled matured un-enriched transactions:
   *    - Normalizes merchant name and resolves FamilyMerchant ID
   *    - Runs categorization against available categories
   *    - Searches for and attaches receipt (and syncs/links bidirectionally with Receipt Wrangler)
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
      skippedCoolingPeriod: 0,
      suppressedHolds: 0,
      processedSettled: 0,
      receiptsMatched: 0,
      receiptsSyncedToWrangler: 0,
      skippedReceiptTriage: 0,
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

    // Suppress superseded pre-tip holds before main enrichment loop
    await this.suppressSupersededHolds(transactions, report);

    let categories: Category[] = [];
    if (this.sureClient && typeof this.sureClient.fetchCategories === 'function') {
      try {
        categories = (await this.sureClient.fetchCategories()) || [];
      } catch (err: any) {
        report.errors.push({ error: `Failed to fetch categories: ${err?.message || String(err)}` });
      }
    }
    const availableCategoryNames = categories.map((c) => c.name);

    const delayDays = opts.ignoreSettlementDelay ? 0 : (opts.settlementDelayDays ?? 0);
    const refTime = opts.referenceDate
      ? new Date(opts.referenceDate).getTime()
      : Date.now();

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

      // 3. Processed check: skip already processed settled transactions (or transactions already locked + categorized in Sure)
      if (this.stateStore.isProcessed(tx.id, tx.amount) || (tx.userModified && tx.categoryId)) {
        if (!this.stateStore.isProcessed(tx.id, tx.amount)) {
          this.stateStore.recordProcessed({
            transactionId: tx.id,
            settledAmount: tx.amount,
            merchantAssigned: tx.cleanName || tx.merchantId || null,
            categoryAssigned: tx.categoryId || null,
            receiptStatus: 'pre_enriched'
          });
        }
        report.skippedAlreadyProcessed++;
        continue;
      }

      // 4. Configurable Settlement Maturity Delay Gate (e.g. 5-day cooling window)
      if (delayDays > 0 && tx.date) {
        const txTime = new Date(tx.date.includes('T') ? tx.date : `${tx.date}T00:00:00Z`).getTime();
        const ageInDays = (refTime - txTime) / (1000 * 60 * 60 * 24);
        if (!Number.isNaN(ageInDays) && ageInDays < delayDays) {
          report.skippedCoolingPeriod = (report.skippedCoolingPeriod || 0) + 1;
          continue;
        }
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
        let isReceiptRelevant = true; // default: assume relevant unless triaged as false
        if (this.categorizer && typeof this.categorizer.categorize === 'function') {
          try {
            const decision: CategorizationDecision | null = await this.categorizer.categorize(
              { ...tx, cleanName },
              availableCategoryNames
            );
            if (decision) {
              if (decision.categoryName) {
                categoryAssigned = decision.categoryName;
                const matched = categories.find(
                  (c) => c.name.toLowerCase() === decision.categoryName.toLowerCase()
                );
                if (matched) {
                  categoryId = matched.id;
                }
              }
              if (typeof decision.isReceiptRelevant === 'boolean') {
                isReceiptRelevant = decision.isReceiptRelevant;
              }
            }
          } catch (cErr: any) {
            report.errors.push({
              transactionId: tx.id,
              error: `Categorization failed: ${cErr?.message || String(cErr)}`
            });
          }
        }

        // Step C: Receipt search & upload (fault tolerant with selective triage + Receipt Wrangler two-way link)
        let receiptStatus = 'none';
        let receiptDeepLink: string | undefined;
        const shouldSearchReceipt = !opts.selectiveReceiptMatching || isReceiptRelevant;

        if (!shouldSearchReceipt) {
          if (report.skippedReceiptTriage !== undefined) {
            report.skippedReceiptTriage++;
          }
        } else if (this.receiptAdapter && typeof this.receiptAdapter.findReceipt === 'function') {
          try {
            let receipt = await this.receiptAdapter.findReceipt({ ...tx, cleanName });
            if (
              !receipt &&
              opts.receiptWranglerLinker &&
              this.receiptAdapter.id !== 'receiptwrangler' &&
              opts.receiptWranglerLinker.isConfigured()
            ) {
              receipt = await opts.receiptWranglerLinker.findReceipt({ ...tx, cleanName });
            }
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
                receiptDeepLink = receipt.orderUrl;

                // Two-way Receipt Wrangler integration:
                // 1) If matched from Receipt Wrangler, mark receipt as RESOLVED
                if (
                  receipt.source === 'receiptwrangler' &&
                  receipt.invoiceNumber &&
                  typeof (this.receiptAdapter as any).markReceiptResolved === 'function'
                ) {
                  await (this.receiptAdapter as any).markReceiptResolved(receipt.invoiceNumber, tx.id);
                }
                // 2) If matched from external adapter (Gmail/Local/IMAP) and RW linker is configured, push to Receipt Wrangler
                else if (
                  receipt.source !== 'receiptwrangler' &&
                  opts.receiptWranglerLinker &&
                  opts.receiptWranglerLinker.autoSyncExternalReceipts
                ) {
                  const synced = await opts.receiptWranglerLinker.uploadExternalReceipt(receipt, {
                    ...tx,
                    cleanName
                  });
                  if (synced?.url) {
                    receiptDeepLink = synced.url;
                    report.receiptsSyncedToWrangler = (report.receiptsSyncedToWrangler || 0) + 1;
                  }
                }
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
        if (receiptDeepLink) {
          const linkNote = `Receipt Wrangler: ${receiptDeepLink}`;
          updates.notes = tx.notes
            ? tx.notes.includes(receiptDeepLink)
              ? tx.notes
              : `${tx.notes} | ${linkNote}`
            : linkNote;
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
