import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { CheckInForm } from './components/CheckInForm.js';

describe('CheckInForm Component', () => {
  it('renders all telemetry fieldsets and inputs with range hints', () => {
    render(<CheckInForm onSubmit={vi.fn()} />);

    expect(screen.getByText('CARDIOVASCULAR')).toBeInTheDocument();
    expect(screen.getByText('MUSCULOSKELETAL')).toBeInTheDocument();
    expect(screen.getByText('IMMUNE')).toBeInTheDocument();
    expect(screen.getByText('BEHAVIORAL')).toBeInTheDocument();
    expect(screen.getByText('ENVIRONMENTAL')).toBeInTheDocument();

    expect(screen.getByLabelText(/Resting Heart Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Allowed: 30–200 bpm/i)).toBeInTheDocument();
  });

  it('validates ranges and displays inline error when metric is out of bounds', async () => {
    const handleSubmit = vi.fn();
    render(<CheckInForm onSubmit={handleSubmit} />);

    const hrInput = screen.getByLabelText(/Resting Heart Rate/i);
    // Out of bounds: 25 bpm (min is 30)
    fireEvent.change(hrInput, { target: { value: '25' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Flight Telemetry/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Out of range \(25\)\. Must be between 30 and 200 bpm/i)).toBeInTheDocument();
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits valid telemetry and displays confirmation message without celebration', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckInForm initialDay={1} onSubmit={handleSubmit} />);

    const submitBtn = screen.getByRole('button', { name: /Submit Flight Telemetry/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Check-in logged successfully for Day 1\./i)).toBeInTheDocument();
  });

  it('accessibility: axe-core finds zero violations in CheckInForm', async () => {
    const { container } = render(
      <main>
        <CheckInForm onSubmit={vi.fn()} />
      </main>,
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});

