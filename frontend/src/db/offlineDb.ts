/**
 * offlineDb.ts – Dexie-based offline storage for Vitalis app shell & check-ins.
 *
 * Implements Prompt 9 requirements:
 * - Queue check-ins in Dexie when backend or Supabase is unreachable.
 * - Sync queued check-ins when connection returns (idempotent by astronaut_id+day).
 * - Cache last-known health status and timestamp.
 * - In headless test environments lacking window.indexedDB, falls back gracefully to in-memory tables.
 */
import Dexie, { type Table } from 'dexie';
import type { CheckInCreate, StatusResponse } from '../types.js';

export interface QueuedCheckIn {
  id?: number;
  astronaut_id: string;
  day: number;
  data: CheckInCreate;
  createdAt: string;
}

export interface CachedStatusRecord {
  astronaut_id: string;
  status: StatusResponse;
  lastSyncedAt: string;
}

export class VitalisOfflineDB extends Dexie {
  queuedCheckIns!: Table<QueuedCheckIn, number>;
  cachedStatus!: Table<CachedStatusRecord, string>;

  constructor() {
    super('VitalisOfflineDB');
    this.version(1).stores({
      queuedCheckIns: '++id, [astronaut_id+day], astronaut_id, day, createdAt',
      cachedStatus: 'astronaut_id, lastSyncedAt',
    });
  }
}

export const dexieDb = new VitalisOfflineDB();

const hasIndexedDB =
  typeof window !== 'undefined' &&
  typeof window.indexedDB !== 'undefined' &&
  window.indexedDB !== null;

// In-memory fallback for test environments or environments where IndexedDB is unavailable
const inMemoryQueued: QueuedCheckIn[] = [];
let nextQueuedId = 1;
const inMemoryCached = new Map<string, CachedStatusRecord>();

export async function queueCheckIn(
  astronautId: string,
  data: CheckInCreate,
): Promise<void> {
  if (hasIndexedDB) {
    try {
      const existing = await dexieDb.queuedCheckIns
        .where('[astronaut_id+day]')
        .equals([astronautId, data.day])
        .first();

      if (existing?.id) {
        await dexieDb.queuedCheckIns.update(existing.id, {
          data,
          createdAt: new Date().toISOString(),
        });
      } else {
        await dexieDb.queuedCheckIns.add({
          astronaut_id: astronautId,
          day: data.day,
          data,
          createdAt: new Date().toISOString(),
        });
      }
      return;
    } catch {
      // Fall through to in-memory if IndexedDB throws
    }
  }

  // In-memory fallback: idempotent on astronaut_id + day
  const idx = inMemoryQueued.findIndex(
    q => q.astronaut_id === astronautId && q.day === data.day,
  );
  if (idx >= 0) {
    const existing = inMemoryQueued[idx];
    if (existing) {
      existing.data = data;
      existing.createdAt = new Date().toISOString();
    }
  } else {
    inMemoryQueued.push({
      id: nextQueuedId++,
      astronaut_id: astronautId,
      day: data.day,
      data,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getQueuedCheckIns(astronautId: string): Promise<QueuedCheckIn[]> {
  if (hasIndexedDB) {
    try {
      return await dexieDb.queuedCheckIns
        .where('astronaut_id')
        .equals(astronautId)
        .sortBy('day');
    } catch {
      // Fall through to in-memory
    }
  }

  return inMemoryQueued
    .filter(q => q.astronaut_id === astronautId)
    .sort((a, b) => a.day - b.day);
}

export async function removeQueuedCheckIn(id: number): Promise<void> {
  if (hasIndexedDB) {
    try {
      await dexieDb.queuedCheckIns.delete(id);
      return;
    } catch {
      // Fall through
    }
  }

  const idx = inMemoryQueued.findIndex(q => q.id === id);
  if (idx >= 0) {
    inMemoryQueued.splice(idx, 1);
  }
}

export async function clearQueuedCheckIns(astronautId?: string): Promise<void> {
  if (hasIndexedDB) {
    try {
      if (astronautId) {
        await dexieDb.queuedCheckIns.where('astronaut_id').equals(astronautId).delete();
      } else {
        await dexieDb.queuedCheckIns.clear();
      }
      return;
    } catch {
      // Fall through
    }
  }

  if (astronautId) {
    for (let i = inMemoryQueued.length - 1; i >= 0; i--) {
      const item = inMemoryQueued[i];
      if (item && item.astronaut_id === astronautId) {
        inMemoryQueued.splice(i, 1);
      }
    }
  } else {
    inMemoryQueued.length = 0;
  }
}

export async function getQueuedCount(astronautId: string): Promise<number> {
  if (hasIndexedDB) {
    try {
      return await dexieDb.queuedCheckIns.where('astronaut_id').equals(astronautId).count();
    } catch {
      // Fall through
    }
  }

  return inMemoryQueued.filter(q => q.astronaut_id === astronautId).length;
}

export async function saveCachedStatus(
  astronautId: string,
  status: StatusResponse,
  lastSyncedAt: string,
): Promise<void> {
  if (hasIndexedDB) {
    try {
      await dexieDb.cachedStatus.put({
        astronaut_id: astronautId,
        status,
        lastSyncedAt,
      });
      return;
    } catch {
      // Fall through
    }
  }

  inMemoryCached.set(astronautId, {
    astronaut_id: astronautId,
    status,
    lastSyncedAt,
  });
}

export async function getCachedStatus(astronautId: string): Promise<CachedStatusRecord | null> {
  if (hasIndexedDB) {
    try {
      const record = await dexieDb.cachedStatus.get(astronautId);
      return record ?? null;
    } catch {
      // Fall through
    }
  }

  return inMemoryCached.get(astronautId) ?? null;
}

export interface SyncResult {
  syncedCount: number;
  errors: string[];
}

/**
 * Synchronize queued check-ins sequentially using the provided sender function.
 * Idempotent by astronaut_id+day on the backend.
 */
export async function syncQueuedCheckIns(
  astronautId: string,
  sendFn: (astronautId: string, data: CheckInCreate) => Promise<unknown>,
): Promise<SyncResult> {
  const queued = await getQueuedCheckIns(astronautId);
  let syncedCount = 0;
  const errors: string[] = [];

  for (const item of queued) {
    try {
      await sendFn(item.astronaut_id, item.data);
      if (item.id !== undefined) {
        await removeQueuedCheckIn(item.id);
      }
      syncedCount++;
    } catch (err) {
      errors.push(
        `Failed to sync Day ${item.day}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Stop on connection error so items stay queued in order
      break;
    }
  }

  return { syncedCount, errors };
}

