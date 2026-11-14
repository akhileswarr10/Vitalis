import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { DomainRow } from './components/DomainRow.js';
import type { DomainStatus } from './types.js';

const NOMINAL_STATUS: DomainStatus = {
  domain: 'cardio',
  level: 0,
  metrics: [
    { key: 'hr', value: 68, level: 0, effectiveWatch: 80, effectiveAction: 90 },
    { key: 'sbp', value: 118, level: 0, effectiveWatch: 140, effectiveAction: 160 },
  ],
  actions: [],
};

const WATCH_STATUS: DomainStatus = {
  domain: 'cardio',
  level: 1,
  metrics: [
    { key: 'hr', value: 82, level: 1, effectiveWatch: 80, effectiveAction: 90 },
    { key: 'sbp', value: 120, level: 0, effectiveWatch: 140, effectiveAction: 160 },
  ],
  actions: ['Log resting heart rate twice daily.', 'Reduce EVA workload for 24 hours.'],
};

const ACTION_STATUS: DomainStatus = {
  domain: 'cardio',
  level: 2,
  metrics: [
    { key: 'hr', value: 92, level: 2, effectiveWatch: 80, effectiveAction: 90 },
    { key: 'sbp', value: 162, level: 2, effectiveWatch: 140, effectiveAction: 160 },
  ],
  actions: [
    'CONTACT GROUND IMMEDIATELY — cardiovascular emergency protocol active.',
    'Cease all strenuous activity; assume supine position.',
  ],
};

describe('DomainRow Component', () => {
  it('renders correctly in NO DATA state', () => {
    const onToggle = vi.fn();
    render(
      <DomainRow
        domain="cardio"
        status={undefined}
        isExpanded={false}
        onToggleExpand={onToggle}
      />,
    );

    expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText(/No telemetry recorded/i)).toBeInTheDocument();
  });

  it('renders correctly in NOMINAL state (Level 0)', () => {
    const onToggle = vi.fn();
    render(
      <DomainRow
        domain="cardio"
        status={NOMINAL_STATUS}
        isExpanded={false}
        onToggleExpand={onToggle}
      />,
    );

    expect(screen.getByText('Nominal')).toBeInTheDocument();
    expect(screen.getByText('●')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
  });

  it('renders correctly in WATCH state (Level 1)', () => {
    const onToggle = vi.fn();
    render(
      <DomainRow
        domain="cardio"
        status={WATCH_STATUS}
        isExpanded={false}
        onToggleExpand={onToggle}
      />,
    );

    expect(screen.getByText('Watch')).toBeInTheDocument();
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText(/Watch boundary reached/i)).toBeInTheDocument();
  });

  it('renders correctly in ACTION state (Level 2) with heavy border & inverted emphasis', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <DomainRow
        domain="cardio"
        status={ACTION_STATUS}
        isExpanded={false}
        onToggleExpand={onToggle}
      />,
    );

    expect(screen.getByText('Action needed')).toBeInTheDocument();
    expect(screen.getByText('◼')).toBeInTheDocument();
    expect(screen.getByText(/Critical action threshold reached/i)).toBeInTheDocument();

    const row = container.querySelector('.domain-row');
    expect(row).toHaveClass('row-action');
  });

  it('expands to reveal thresholds and deterministic action steps', () => {
    let expanded = false;
    const { rerender } = render(
      <DomainRow
        domain="cardio"
        status={ACTION_STATUS}
        isExpanded={expanded}
        onToggleExpand={() => {
          expanded = !expanded;
        }}
      />,
    );

    // Not expanded initially
    expect(screen.queryByTestId('domain-expanded-cardio')).not.toBeInTheDocument();

    // Expand
    rerender(
      <DomainRow
        domain="cardio"
        status={ACTION_STATUS}
        isExpanded={true}
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByTestId('domain-expanded-cardio')).toBeInTheDocument();
    expect(screen.getByText(/METRIC THRESHOLDS & DRIFT/i)).toBeInTheDocument();
    expect(
      screen.getByText(/CONTACT GROUND IMMEDIATELY — cardiovascular emergency protocol active./i),
    ).toBeInTheDocument();
  });

  it('accessibility: axe-core finds zero violations in DomainRow', async () => {
    const { container } = render(
      <main>
        <DomainRow
          domain="cardio"
          status={WATCH_STATUS}
          isExpanded={true}
          onToggleExpand={() => {}}
        />
      </main>,
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
