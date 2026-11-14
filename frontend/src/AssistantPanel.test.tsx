import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { AssistantPanel } from './components/AssistantPanel.js';
import { getSuggestedQuestions } from './utils/assistant.js';
import type { AssistantAnswer, DomainStatus } from './types.js';

const MOCK_FLAGGED_DOMAINS: DomainStatus[] = [
  {
    domain: 'behav',
    level: 1,
    metrics: [{ key: 'sleep', value: 5.8, level: 1, effectiveWatch: 6.5, effectiveAction: 5.5 }],
    actions: [],
  },
  {
    domain: 'env',
    level: 2,
    metrics: [{ key: 'co2', value: 5200, level: 2, effectiveWatch: 1000, effectiveAction: 5000 }],
    actions: [],
  },
];

const STANDARD_ANSWER: AssistantAnswer = {
  summary: 'Core vitals show elevated cabin CO2 exposure.',
  explanation: 'Environmental CO2 has surpassed 5000 ppm contingency threshold.',
  steps: [
    'Don emergency breathing masks immediately.',
    'Switch secondary amine scrubbing beds to active mode.',
  ],
  escalate: false,
  sources: ['cabin-co2.md'],
  fallback_used: false,
};

describe('AssistantPanel Component (Prompt 8)', () => {
  it('generates 3 contextual suggested questions matching flagged domains', () => {
    const questions = getSuggestedQuestions(MOCK_FLAGGED_DOMAINS);
    expect(questions.length).toBe(3);
    // Should contain questions for behavioral (sleep) and environmental (co2)
    expect(questions).toContain('Why is my sleep flagged?');
    expect(questions).toContain('What should I do about rising CO2?');
  });

  it('renders loading state while awaiting assistant response', async () => {
    // Hangs the promise to test loading state
    const onAsk = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(
      <AssistantPanel
        astronautId="crew-01"
        flaggedDomains={MOCK_FLAGGED_DOMAINS}
        onAsk={onAsk}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Why is my resting heart rate elevated/i);
    fireEvent.change(textarea, { target: { value: 'Why is cabin CO2 rising?' } });

    const askBtn = screen.getByRole('button', { name: /Ask Assistant/i });
    fireEvent.click(askBtn);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Consulting onboard knowledge base and telemetry/i)).toBeInTheDocument();
    expect(askBtn).toBeDisabled();
  });

  it('renders answer state with summary, explanation, steps, and sources as chips', async () => {
    const onAsk = vi.fn().mockResolvedValue(STANDARD_ANSWER);

    render(
      <AssistantPanel
        astronautId="crew-01"
        flaggedDomains={MOCK_FLAGGED_DOMAINS}
        onAsk={onAsk}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Why is my resting heart rate elevated/i);
    fireEvent.change(textarea, { target: { value: 'How is cabin CO2?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    await waitFor(() => {
      expect(screen.getByText('Core vitals show elevated cabin CO2 exposure.')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Environmental CO2 has surpassed 5000 ppm contingency threshold.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Don emergency breathing masks immediately.')).toBeInTheDocument();
    expect(
      screen.getByText('Switch secondary amine scrubbing beds to active mode.'),
    ).toBeInTheDocument();
    expect(screen.getByText('cabin-co2.md')).toBeInTheDocument();

    // Not escalated and not fallback
    expect(screen.queryByText(/ESCALATE TO GROUND/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fallback guidance/i)).not.toBeInTheDocument();
  });

  it('renders ESCALATE badge when escalate=true', async () => {
    const escalateAnswer: AssistantAnswer = {
      ...STANDARD_ANSWER,
      escalate: true,
    };
    const onAsk = vi.fn().mockResolvedValue(escalateAnswer);

    render(
      <AssistantPanel
        astronautId="crew-01"
        flaggedDomains={MOCK_FLAGGED_DOMAINS}
        onAsk={onAsk}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Why is my resting heart rate elevated/i), {
      target: { value: 'Emergency question' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    await waitFor(() => {
      expect(screen.getByText(/ESCALATE TO GROUND IMMEDIATELY/i)).toBeInTheDocument();
    });
  });

  it('renders visible "Fallback guidance (deterministic)" label when fallback_used=true', async () => {
    const fallbackAnswer: AssistantAnswer = {
      ...STANDARD_ANSWER,
      fallback_used: true,
      sources: ['engine/actions.ts (deterministic fallback)'],
    };
    const onAsk = vi.fn().mockResolvedValue(fallbackAnswer);

    render(
      <AssistantPanel
        astronautId="crew-01"
        flaggedDomains={MOCK_FLAGGED_DOMAINS}
        onAsk={onAsk}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Why is my resting heart rate elevated/i), {
      target: { value: 'Query during Groq outage' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    await waitFor(() => {
      expect(screen.getByText(/Fallback guidance \(deterministic\)/i)).toBeInTheDocument();
    });
  });

  it('renders error state on API failure and provides retry mechanism', async () => {
    const onAsk = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network offline. Cannot reach backend API.'))
      .mockResolvedValueOnce(STANDARD_ANSWER);

    render(
      <AssistantPanel
        astronautId="crew-01"
        flaggedDomains={MOCK_FLAGGED_DOMAINS}
        onAsk={onAsk}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Why is my resting heart rate elevated/i), {
      target: { value: 'Test error handling' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Network offline\. Cannot reach backend API\./i)).toBeInTheDocument();
    });

    // Clicking retry attempts the call again
    fireEvent.click(screen.getByRole('button', { name: /Retry Request/i }));

    await waitFor(() => {
      expect(screen.getByText('Core vitals show elevated cabin CO2 exposure.')).toBeInTheDocument();
    });
  });

  it('escapes model text and NEVER renders raw HTML', async () => {
    const xssAnswer: AssistantAnswer = {
      summary: '<img src=x onerror=alert(1)>Malicious summary',
      explanation: '<b>Bold attempt</b> and <script>alert(2)</script>',
      steps: ['<a href="javascript:void(0)">Click here</a>'],
      escalate: false,
      sources: ['test.md'],
      fallback_used: false,
    };
    const onAsk = vi.fn().mockResolvedValue(xssAnswer);

    const { container } = render(
      <AssistantPanel
        astronautId="crew-01"
        flaggedDomains={MOCK_FLAGGED_DOMAINS}
        onAsk={onAsk}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Why is my resting heart rate elevated/i), {
      target: { value: 'Prompt injection test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    await waitFor(() => {
      expect(screen.getByText('<img src=x onerror=alert(1)>Malicious summary')).toBeInTheDocument();
    });

    // Verify raw tags do NOT exist in the DOM as HTML elements
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('accessibility: axe-core finds zero violations in AssistantPanel', async () => {
    const onAsk = vi.fn().mockResolvedValue(STANDARD_ANSWER);
    const { container } = render(
      <main>
        <AssistantPanel
          astronautId="crew-01"
          flaggedDomains={MOCK_FLAGGED_DOMAINS}
          onAsk={onAsk}
        />
      </main>,
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
