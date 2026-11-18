import api, { isNetworkError, errorMessage } from '../api/client';

export interface OutboxItem {
  id: string; // client_uuid
  url: string;
  method: 'POST' | 'PUT';
  body: Record<string, unknown>;
  label: string;
  createdAt: string;
  error?: string;
}

const OUTBOX_KEY = 'gym_outbox_queue';
type Listener = (items: OutboxItem[], isSyncing: boolean) => void;
const listeners = new Set<Listener>();
let isSyncing = false;

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOutboxItems(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveOutboxItems(items: OutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    // storage full
  }
  notify();
}

function notify(): void {
  const items = getOutboxItems();
  listeners.forEach((fn) => fn(items, isSyncing));
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  fn(getOutboxItems(), isSyncing);
  return () => listeners.delete(fn);
}

export function discardOutboxItem(id: string): void {
  const filtered = getOutboxItems().filter((item) => item.id !== id);
  saveOutboxItems(filtered);
}

/**
 * Submit an action immediately if online, or queue into offline outbox if offline.
 */
export async function submitWithOutbox<T = unknown>(
  url: string,
  body: Record<string, unknown>,
  label: string
): Promise<{ data?: T; queued?: boolean }> {
  // Ensure client_uuid is stamped
  const clientUuid = (body.client_uuid as string) || generateUuid();
  const payload = { ...body, client_uuid: clientUuid };

  try {
    const res = await api.post<T>(url, payload);
    return { data: res.data };
  } catch (err) {
    if (!isNetworkError(err)) {
      throw err; // Validation or logic errors bubble up immediately
    }

    // Network is offline: queue to outbox
    const items = getOutboxItems();
    if (!items.some((i) => i.id === clientUuid)) {
      items.push({
        id: clientUuid,
        url,
        method: 'POST',
        body: payload,
        label,
        createdAt: new Date().toISOString(),
      });
      saveOutboxItems(items);
    }

    return { queued: true };
  }
}

/**
 * Sync all pending outbox items sequentially.
 */
export async function syncOutbox(): Promise<number> {
  if (isSyncing || !navigator.onLine) return 0;
  isSyncing = true;
  notify();

  let syncedCount = 0;
  try {
    const items = getOutboxItems();
    for (const item of items) {
      if (item.error) continue; // Skip failed rejection
      try {
        await api.post(item.url, item.body);
        const remaining = getOutboxItems().filter((i) => i.id !== item.id);
        saveOutboxItems(remaining);
        syncedCount++;
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          break; // Stop sync if network drops again
        }
        // If server rejected with a 422 or business logic failure, flag the item with the error message
        const updated = getOutboxItems().map((i) =>
          i.id === item.id ? { ...i, error: errorMessage(err) } : i
        );
        saveOutboxItems(updated);
      }
    }
  } finally {
    isSyncing = false;
    notify();
  }

  return syncedCount;
}

// Auto sync when browser comes online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOutbox();
  });
}
