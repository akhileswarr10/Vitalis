/**
 * offlineSync.test.ts – Acceptance tests for offline queueing and synchronization.
 *
 * Prompt 9 Acceptance:
 * - "the sync test passes"
 * - "queue check-ins in Dexie and sync when it returns (idempotent by astronaut_id+day, matching the backend upsert)"
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queueCheckIn,
  getQueuedCheckIns,
  clearQueuedCheckIns,
  getQueuedCount,
  syncQueuedCheckIns,
  saveCachedStatus,
  getCachedStatus,
} from './db/offlineDb.js';
import type { CheckInCreate, StatusResponse } from './types.js';

const sampleCheckIn1: CheckInCreate = {
  day: 10,
  hr: 72,
  sbp: 120,
  ortho: 10,
  ex: 60,
  bone: 8,
  temp: 36.6,
  sym: 0,
  sleep: 7.5,
  mood: 8,
  stress: 2,
  dose: 0.35,
  co2: 500,
};

const sampleCheckIn2: CheckInCreate = {
  ...sampleCheckIn1,
  day: 11,
  hr: 75,
};

const sampleStatus: StatusResponse = {
  astronaut_id: 'crew-01',
  overall: 0,
  multi_domain: false,
  hrBaseline: 70,
  hrBaselineFallback: false,
  domains: [
    {
      domain: 'cardio',
      level: 0,
      metrics: [],
      actions: [],
    },
  ],
  metrics: [],
  anomalies: [],
  entry_count: 9,
};

describe('Offline Storage and Synchronization (Prompt 9)', () => {
  beforeEach(async () => {
    await clearQueuedCheckIns();
  });

  it('queues a check-in and updates count', async () => {
    expect(await getQueuedCount('crew-01')).toBe(0);

    await queueCheckIn('crew-01', sampleCheckIn1);

    expect(await getQueuedCount('crew-01')).toBe(1);
    const queued = await getQueuedCheckIns('crew-01');
    expect(queued).toHaveLength(1);
    expect(queued[0]?.day).toBe(10);
    expect(queued[0]?.data.hr).toBe(72);
  });

  it('is idempotent on (astronaut_id, day): updates existing queued entry instead of duplicating', async () => {
    await queueCheckIn('crew-01', sampleCheckIn1);
    expect(await getQueuedCount('crew-01')).toBe(1);

    // Re-queue same day with updated HR
    const updatedCheckIn1: CheckInCreate = {
      ...sampleCheckIn1,
      hr: 85,
    };
    await queueCheckIn('crew-01', updatedCheckIn1);

    // Count should still be 1, but HR updated
    expect(await getQueuedCount('crew-01')).toBe(1);
    const queued = await getQueuedCheckIns('crew-01');
    expect(queued).toHaveLength(1);
    expect(queued[0]?.day).toBe(10);
    expect(queued[0]?.data.hr).toBe(85);
  });

  it('syncs queued check-ins sequentially and removes them on success', async () => {
    await queueCheckIn('crew-01', sampleCheckIn1); // Day 10
    await queueCheckIn('crew-01', sampleCheckIn2); // Day 11

    expect(await getQueuedCount('crew-01')).toBe(2);

    const sentDays: number[] = [];
    const mockSender = vi.fn(async (astronautId: string, data: CheckInCreate) => {
      expect(astronautId).toBe('crew-01');
      sentDays.push(data.day);
      return { id: 100, ...data };
    });

    const result = await syncQueuedCheckIns('crew-01', mockSender);

    expect(result.syncedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(sentDays).toEqual([10, 11]); // In chronological order
    expect(await getQueuedCount('crew-01')).toBe(0);
  });

  it('stops and preserves remaining queue if network fails mid-sync', async () => {
    await queueCheckIn('crew-01', sampleCheckIn1); // Day 10
    await queueCheckIn('crew-01', sampleCheckIn2); // Day 11

    let calls = 0;
    const mockSender = vi.fn(async (_astronautId: string, _data: CheckInCreate) => {
      calls++;
      if (calls === 2) {
        throw new Error('Connection lost to telemetry server');
      }
      return {};
    });

    const result = await syncQueuedCheckIns('crew-01', mockSender);

    expect(result.syncedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Connection lost to telemetry server');

    // Day 10 was synced and removed, Day 11 remains queued
    const remaining = await getQueuedCheckIns('crew-01');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.day).toBe(11);
  });

  it('saves and retrieves cached health status for offline display', async () => {
    await saveCachedStatus('crew-01', sampleStatus, '12:00 UTC');

    const cached = await getCachedStatus('crew-01');
    expect(cached).not.toBeNull();
    expect(cached?.astronaut_id).toBe('crew-01');
    expect(cached?.lastSyncedAt).toBe('12:00 UTC');
    expect(cached?.status.overall).toBe(0);
  });
});
