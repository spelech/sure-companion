import { SettledTransaction, TransactionUpdate, Category } from '../types';

export class SureClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const isHexApiKey = /^[0-9a-f]{64}$/i.test(this.token) || this.token.startsWith('demo_monitoring_key_');
    const authHeaders: Record<string, string> = isHexApiKey
      ? { 'X-Api-Key': this.token }
      : { Authorization: `Bearer ${this.token}`, 'X-Api-Key': this.token };

    const headers: Record<string, string> = {
      ...authHeaders,
      ...(options.headers as Record<string, string>)
    };

    // If body is not FormData and Content-Type is not explicitly set, set application/json
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errorBody = '';
      try {
        if (typeof res.text === 'function') {
          errorBody = await res.text();
        } else if (typeof res.json === 'function') {
          errorBody = JSON.stringify(await res.json());
        }
      } catch {
        errorBody = res.statusText;
      }
      throw new Error(`Sure API error (${res.status} ${res.statusText}): ${errorBody}`);
    }

    // If empty response or 204 No Content
    if (res.status === 204) {
      return undefined as unknown as T;
    }

    try {
      if (typeof res.json === 'function') {
        return (await res.json()) as T;
      }
    } catch {
      return undefined as unknown as T;
    }

    return undefined as unknown as T;
  }

  /**
   * Fetches recent transactions within the specified days window
   * and maps them to SettledTransaction.
   */
  async fetchTransactions(days: number = 14): Promise<SettledTransaction[]> {
    let endpoint = '/api/v1/transactions?per_page=100';
    if (days > 0) {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endpoint += `&start_date=${startDate}`;
    }

    const data = await this.request(endpoint, { method: 'GET' });
    const rawList: any[] = Array.isArray(data) ? data : (data?.transactions || []);

    return rawList.map((raw): SettledTransaction => {
      let amount = 0;
      if (raw.amount_cents != null) {
        amount = Math.abs(raw.amount_cents) / 100;
      } else if (typeof raw.amount === 'number') {
        amount = Math.abs(raw.amount);
      } else if (typeof raw.amount === 'string') {
        const cleaned = raw.amount.replace(/[^0-9.-]+/g, '');
        amount = Math.abs(parseFloat(cleaned)) || 0;
      }

      const rawName = raw.name || raw.raw_name || raw.rawName || raw.description || '';
      const cleanName = raw.clean_name || raw.cleanName || raw.merchant?.name || undefined;
      const merchantId = raw.merchant_id || raw.merchantId || raw.merchant?.id || undefined;
      const categoryId = raw.category_id || raw.categoryId || raw.category?.id || undefined;

      let pending = false;
      if (raw.pending === true) {
        pending = true;
      } else if (raw.status === 'pending' || raw.status === 'hold') {
        pending = true;
      } else if (raw.extra && typeof raw.extra === 'object') {
        for (const key of Object.keys(raw.extra)) {
          if (raw.extra[key]?.pending === true) {
            pending = true;
            break;
          }
        }
      }

      const excluded = Boolean(raw.excluded || raw.is_excluded || raw.status === 'excluded');
      const currency = raw.currency || 'USD';
      const accountId = raw.account_id || raw.accountId || raw.account?.id || undefined;
      const notes = raw.notes || undefined;

      const mapped: SettledTransaction = {
        id: raw.id,
        date: raw.date,
        amount,
        rawName,
        cleanName,
        merchantId,
        categoryId,
        pending,
        excluded,
        currency
      };
      if (accountId) mapped.accountId = accountId;
      if (notes) mapped.notes = notes;
      if (raw.user_modified === true || raw.userModified === true) {
        mapped.userModified = true;
      }

      return mapped;
    });
  }

  /**
   * Retrieves existing categories from Sure.
   */
  async fetchCategories(): Promise<Category[]> {
    const data = await this.request('/api/v1/categories', { method: 'GET' });
    const rawList: any[] = Array.isArray(data) ? data : (data?.categories || []);

    return rawList.map((c): Category => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon || c.lucide_icon,
      parentId: c.parent_id || c.parentId
    }));
  }

  /**
   * Finds an existing FamilyMerchant by name (case-insensitive)
   * or creates a new one in Sure and returns its ID.
   */
  async findOrCreateFamilyMerchant(name: string, websiteUrl?: string): Promise<string> {
    const merchantsData = await this.request('/api/v1/merchants', { method: 'GET' });
    const merchants: any[] = Array.isArray(merchantsData) ? merchantsData : (merchantsData?.merchants || []);

    const target = name.trim().toLowerCase();
    const existing = merchants.find((m) => m?.name && m.name.trim().toLowerCase() === target);
    if (existing?.id) {
      return existing.id;
    }

    // Try creating via JSON POST first
    try {
      const payload: Record<string, any> = {
        name,
        type: 'FamilyMerchant'
      };
      if (websiteUrl) payload.website_url = websiteUrl;

      const created = await this.request('/api/v1/merchants', {
        method: 'POST',
        body: JSON.stringify({
          merchant: payload,
          ...payload
        })
      });

      const newId = created?.id || created?.merchant?.id || created?.merchants?.[0]?.id;
      if (newId) return newId;
    } catch (err) {
      // Fallback to CSV upload for stock Sure endpoints that enforce CSV import
      const csv = `name,color,website_url\n"${name.replace(/"/g, '""')}",,"${websiteUrl ? websiteUrl.replace(/"/g, '""') : ''}"\n`;
      const formData = new FormData();
      formData.append('file', new Blob([csv], { type: 'text/csv' }), 'merchants.csv');

      const csvRes = await this.request('/api/v1/merchants', {
        method: 'POST',
        body: formData
      });

      const csvId = csvRes?.merchants?.[0]?.id || csvRes?.id;
      if (csvId) return csvId;

      throw err;
    }

    throw new Error(`Failed to create merchant '${name}': No ID returned by Sure API.`);
  }

  /**
   * Updates a transaction in Sure with user_modified=true lock.
   */
  async updateTransaction(id: string, updates: Partial<TransactionUpdate>): Promise<void> {
    const transaction: Record<string, any> = {};

    if (updates.merchantId !== undefined) transaction.merchant_id = updates.merchantId;
    if (updates.categoryId !== undefined) transaction.category_id = updates.categoryId;
    if (updates.notes !== undefined) transaction.notes = updates.notes;
    if (updates.name !== undefined) transaction.name = updates.name;
    if (updates.date !== undefined) transaction.date = updates.date;
    if (updates.amount !== undefined) transaction.amount = updates.amount;
    if (updates.currency !== undefined) transaction.currency = updates.currency;
    if (updates.excluded !== undefined) transaction.excluded = updates.excluded;

    // Critical: user_modified must be set to true to prevent aggregator sync reversions
    transaction.user_modified = updates.userModified ?? true;

    await this.request(`/api/v1/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ transaction })
    });
  }

  /**
   * Uploads receipt attachment to /api/v1/transactions/:id/attachments.
   */
  async uploadAttachment(id: string, file: Buffer, fileName: string, mimeType: string): Promise<void> {
    const formData = new FormData();
    const blob = new Blob([file], { type: mimeType });
    formData.append('file', blob, fileName);

    await this.request(`/api/v1/transactions/${id}/attachments`, {
      method: 'POST',
      body: formData
    });
  }
}
