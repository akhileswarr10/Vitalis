/**
 * SpaceWeatherCard.test.tsx – Component tests for Space Weather Card (Prompt 10).
 *
 * Verifies:
 * - Quiet state (nominal space weather)
 * - Unavailable/offline state (soft failure)
 * - Strong event advisory state (active advisory with radiation guide link)
 * - Axe-core accessibility audit (0 violations)
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import { SpaceWeatherCard } from './components/SpaceWeatherCard.js';
import type { SpaceWeatherResponse } from './types.js';

const quietData: SpaceWeatherResponse = {
  available: true,
  cached: false,
  last_updated: '2026-05-10T12:00:00Z',
  has_strong_event: false,
  advisory: null,
  flares: [
    {
      flrID: '2026-05-09-FLR-001',
      beginTime: '2026-05-09T10:00Z',
      classType: 'C2.4',
    },
  ],
  cmes: [
    {
      activityID: '2026-05-09-CME-001',
      startTime: '2026-05-09T10:30Z',
      speed: 450,
    },
  ],
};

const strongEventData: SpaceWeatherResponse = {
  available: true,
  cached: false,
  last_updated: '2026-05-10T12:00:00Z',
  has_strong_event: true,
  advisory: 'High-energy solar activity detected: X2.5 solar flare (2026-05-10-FLR-001). Review onboard guide: radiation-spe-shelter.md.',
  flares: [
    {
      flrID: '2026-05-10-FLR-001',
      beginTime: '2026-05-10T11:45Z',
      classType: 'X2.5',
    },
  ],
  cmes: [
    {
      activityID: '2026-05-10-CME-001',
      startTime: '2026-05-10T12:00Z',
      speed: 1300,
    },
  ],
};

describe('SpaceWeatherCard Component (Prompt 10)', () => {
  it('renders quiet solar telemetry nominally', () => {
    render(<SpaceWeatherCard data={quietData} />);

    expect(screen.getByText('Space Weather // NASA DONKI')).toBeInTheDocument();
    expect(screen.getByText('SOLAR QUIET')).toBeInTheDocument();
    expect(screen.getByText(/Peak: C2.4/i)).toBeInTheDocument();
    expect(screen.getByText(/Top: 450 km\/s/i)).toBeInTheDocument();
    expect(screen.queryByText(/SOLAR PARTICLE EVENT ADVISORY/i)).not.toBeInTheDocument();
  });

  it('renders offline message when feed is unavailable', () => {
    render(<SpaceWeatherCard data={{ available: false }} />);

    expect(screen.getByText('FEED OFFLINE')).toBeInTheDocument();
    expect(screen.getByText(/Space weather telemetry feed offline or rate-limited/i)).toBeInTheDocument();
    expect(screen.getByText(/Onboard clinical decision support continues nominal/i)).toBeInTheDocument();
  });

  it('renders advisory and triggers radiation guide navigation on strong event', () => {
    const handleGuide = vi.fn();
    render(
      <SpaceWeatherCard
        data={strongEventData}
        onOpenRadiationGuide={handleGuide}
      />,
    );

    expect(screen.getByText('ADVISORY ACTIVE')).toBeInTheDocument();
    expect(screen.getByText(/SOLAR PARTICLE EVENT ADVISORY/i)).toBeInTheDocument();
    expect(screen.getByText(/High-energy solar activity detected: X2.5/i)).toBeInTheDocument();
    expect(screen.getByText(/Space weather advisories do not change rules engine health levels/i)).toBeInTheDocument();

    const guideBtn = screen.getByRole('button', { name: /View Radiation SPE Shelter Guide/i });
    fireEvent.click(guideBtn);
    expect(handleGuide).toHaveBeenCalledTimes(1);
  });

  it('accessibility: axe-core finds zero violations in SpaceWeatherCard', async () => {
    const { container } = render(
      <SpaceWeatherCard
        data={strongEventData}
        onOpenRadiationGuide={vi.fn()}
      />,
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});

