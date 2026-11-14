/**
 * AppOffline.test.tsx – Acceptance tests for offline mode & PWA degradation.
 *
 * Prompt 9 Acceptance:
 * - "with the network off the app loads and accepts a check-in"
 * - "show the last-known status with a visible 'Last synced <time>, offline' label, and keep the form usable"
 * - "UI button to copy/download it"
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import axe from 'axe-core';
import App from './App.js';
import { api } from './api/client.js';
import { saveCachedStatus, clearQueuedCheckIns, getQueuedCheckIns } from './db/offlineDb.js';
import type { StatusResponse } from './types.js';

const mockCachedStatus: StatusResponse = {
  astronaut_id: 'crew-01',
  overall: 1, // Watch
  multi_domain: false,
  hrBaseline: 70,
  hrBaselineFallback: false,
  domains: [
    {
      domain: 'cardio',
      level: 1,
      metrics: [
        {
          key: 'hr',
          value: 88,
          level: 1,
          effectiveWatch: 85,
          effectiveAction: 95,
        },
        {
          key: 'sbp',
          value: 125,
          level: 0,
          effectiveWatch: 140,
          effectiveAction: 160,
        },
        {
          key: 'ortho',
          value: 12,
          level: 0,
          effectiveWatch: 20,
          effectiveAction: 30,
        },
      ],
      actions: ['Log resting heart rate and blood pressure twice daily.'],
    },
    {
      domain: 'msk',
      level: 0,
      metrics: [],
      actions: [],
    },
    {
      domain: 'immune',
      level: 0,
      metrics: [],
      actions: [],
    },
    {
      domain: 'behav',
      level: 0,
      metrics: [],
      actions: [],
    },
    {
      domain: 'env',
      level: 0,
      metrics: [],
      actions: [],
    },
  ],
  metrics: [],
  anomalies: [],
  entry_count: 5,
};

describe('Offline Application Degradation (Prompt 9 Acceptance)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearQueuedCheckIns();
  });

  it('loads cached status with visible "Last synced <time>, offline" label when network is off', async () => {
    // 1. Pre-populate Dexie cache with last-known status
    await saveCachedStatus('crew-01', mockCachedStatus, '10:45 UTC');

    // 2. Mock backend unreachable (network off)
    vi.spyOn(api, 'getStatus').mockRejectedValue(new Error('Failed to fetch: Network unreachable'));
    vi.spyOn(api, 'getCheckIns').mockRejectedValue(new Error('Failed to fetch: Network unreachable'));

    render(<App />);

    // 3. Verify visible offline label with last synced time
    const syncLabel = await screen.findByTestId('sync-time-label');
    expect(syncLabel).toHaveTextContent('Last synced 10:45 UTC, offline');

    // 4. Verify telemetry domains are rendered from cached status
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
    expect(screen.getByText('OFFLINE TELEMETRY')).toBeInTheDocument();
  });

  it('keeps the check-in form usable and queues check-in when network is off', async () => {
    await saveCachedStatus('crew-01', mockCachedStatus, '10:45 UTC');

    vi.spyOn(api, 'getStatus').mockRejectedValue(new Error('Failed to fetch'));
    vi.spyOn(api, 'getCheckIns').mockRejectedValue(new Error('Failed to fetch'));
    const addCheckInSpy = vi.spyOn(api, 'addCheckIn').mockRejectedValue(new Error('Network error'));

    render(<App />);

    // Wait for cached dashboard to load
    await screen.findByTestId('sync-time-label');

    // Switch to Check-In tab
    const checkInTab = screen.getByRole('tab', { name: /\+ Log Check-In/i });
    fireEvent.click(checkInTab);

    // Form inputs should be visible and usable with defaults
    expect(screen.getByLabelText(/Resting Heart Rate/i)).toBeInTheDocument();

    // Submit while offline
    const submitBtn = screen.getByRole('button', { name: /Submit Flight Telemetry/i });
    fireEvent.click(submitBtn);

    // When offline, does not attempt network call
    expect(addCheckInSpy).not.toHaveBeenCalled();

    // Verify submission notice indicates offline queueing
    await waitFor(() => {
      expect(
        screen.getByText(/Offline: check-in queued for Day 6. Will sync when connection is restored./i),
      ).toBeInTheDocument();
    });

    // Verify item is safely stored in offline queue
    const queued = await getQueuedCheckIns('crew-01');
    expect(queued).toHaveLength(1);
    expect(queued[0]?.day).toBe(6);
    expect(queued[0]?.data.hr).toBe(68);
  });

  it('supports copying and downloading the ground report', async () => {
    await saveCachedStatus('crew-01', mockCachedStatus, '10:45 UTC');
    vi.spyOn(api, 'getStatus').mockRejectedValue(new Error('Offline'));
    vi.spyOn(api, 'getCheckIns').mockRejectedValue(new Error('Offline'));

    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    render(<App />);
    await screen.findByTestId('sync-time-label');

    // Click "Copy Report"
    const copyBtn = screen.getByRole('button', { name: /Copy plain-text ground report/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled();
      const call = writeTextSpy.mock.calls[0];
      const copiedText = call ? call[0] : '';
      expect(copiedText).toContain('Decision support only. Not a medical device.');
      expect(copiedText).toContain('VITALIS CREW HEALTH STATUS REPORT');
      expect(screen.getByText('Report copied to clipboard')).toBeInTheDocument();
    });

    // Click "Download Report"
    const downloadBtn = screen.getByRole('button', { name: /Download plain-text ground telemetry report/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByText('Report downloaded')).toBeInTheDocument();
    });
  });

  it('accessibility: axe-core finds zero violations in offline mode', async () => {
    await saveCachedStatus('crew-01', mockCachedStatus, '10:45 UTC');
    vi.spyOn(api, 'getStatus').mockRejectedValue(new Error('Offline'));
    vi.spyOn(api, 'getCheckIns').mockRejectedValue(new Error('Offline'));

    const { container } = render(<App />);
    await screen.findByTestId('sync-time-label');

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
