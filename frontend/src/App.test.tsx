import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.js';
import { api } from './api/client.js';

vi.mock('./api/client.js', () => ({
  api: {
    getStatus: vi.fn(),
    getCheckIns: vi.fn(),
    seedDemo: vi.fn(),
    addCheckIn: vi.fn(),
  },
}));

const MOCK_STATUS = {
  astronaut_id: 'crew-01',
  overall: 0 as const,
  multi_domain: false,
  hrBaseline: 70,
  hrBaselineFallback: false,
  entry_count: 5,
  anomalies: [],
  domains: [
    {
      domain: 'cardio' as const,
      level: 0 as const,
      metrics: [
        { key: 'hr', value: 72, level: 0 as const, effectiveWatch: 85, effectiveAction: 95 },
        { key: 'sbp', value: 120, level: 0 as const, effectiveWatch: 140, effectiveAction: 160 },
      ],
      actions: [],
    },
    {
      domain: 'msk' as const,
      level: 0 as const,
      metrics: [],
      actions: [],
    },
    {
      domain: 'immune' as const,
      level: 0 as const,
      metrics: [],
      actions: [],
    },
    {
      domain: 'behav' as const,
      level: 0 as const,
      metrics: [],
      actions: [],
    },
    {
      domain: 'env' as const,
      level: 0 as const,
      metrics: [],
      actions: [],
    },
  ],
  metrics: [],
};

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the persistent medical disclaimer banner (RESTRICTIONS.md §1)', async () => {
    vi.mocked(api.getStatus).mockResolvedValue(MOCK_STATUS);
    vi.mocked(api.getCheckIns).mockResolvedValue([]);

    render(<App />);

    expect(
      screen.getByText(/Decision support only\. Not a medical device\./i),
    ).toBeInTheDocument();
  });

  it('loads and displays the telemetry domains', async () => {
    vi.mocked(api.getStatus).mockResolvedValue(MOCK_STATUS);
    vi.mocked(api.getCheckIns).mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
      expect(screen.getByText('Musculoskeletal')).toBeInTheDocument();
      expect(screen.getByText('Immune')).toBeInTheDocument();
      expect(screen.getByText('Behavioral')).toBeInTheDocument();
      expect(screen.getByText('Environmental')).toBeInTheDocument();
    });
  });
});
