import {
  CompanionConfig,
  CompanionStatus,
  TestReceiptResponse,
  TestSureResponse,
  TestCategorizationResponse,
  SyncReport
} from './types';

const BASE_URL = '';

export async function fetchConfig(): Promise<CompanionConfig> {
  const res = await fetch(`${BASE_URL}/api/config`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch config (${res.status})`);
  }
  return res.json();
}

export async function updateConfig(
  patch: Partial<CompanionConfig>
): Promise<CompanionConfig> {
  const res = await fetch(`${BASE_URL}/api/config`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to update config (${res.status})`);
  }
  return res.json();
}

export async function fetchStatus(): Promise<CompanionStatus> {
  const res = await fetch(`${BASE_URL}/api/status`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch status (${res.status})`);
  }
  return res.json();
}

export async function runSync(options?: {
  ignoreSettlementDelay?: boolean;
}): Promise<{ success: boolean; report: SyncReport }> {
  const res = await fetch(`${BASE_URL}/api/sync/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ignoreSettlementDelay: options?.ignoreSettlementDelay ?? false
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Sync failed (${res.status})`);
  }
  return data;
}

export async function testSure(
  baseUrl?: string,
  apiToken?: string
): Promise<TestSureResponse> {
  const res = await fetch(`${BASE_URL}/api/test/sure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ baseUrl, apiToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Sure connection test failed (${res.status})`);
  }
  return data;
}

export async function testReceipt(params: {
  date?: string;
  amount?: number;
  rawName?: string;
}): Promise<TestReceiptResponse> {
  const res = await fetch(`${BASE_URL}/api/test/receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Receipt search test failed (${res.status})`);
  }
  return data;
}

export async function testCategorization(params: {
  rawName?: string;
  amount?: number;
  date?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): Promise<TestCategorizationResponse> {
  const res = await fetch(`${BASE_URL}/api/test/categorization`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Categorization test failed (${res.status})`);
  }
  return data;
}
