/**
 * actions.ts – Deterministic guidance text per domain × level.
 * No I/O, no randomness. Used by the LLM service as the final fallback
 * (CLAUDE.md rule 1 & 3: level-2 emergency steps always shown regardless of LLM).
 *
 * RESTRICTIONS.md §1: Level 2 ALWAYS shows emergency steps, regardless of LLM output.
 */
import type { Domain } from './thresholds.js';
import type { Level } from './evaluate.js';
import type { AssessResult } from './evaluate.js';

// ---- Guidance tables -------------------------------------------------------

const ACTIONS: Record<Domain, Record<Level, string[]>> = {
  cardio: {
    0: [],
    1: [
      'Log resting heart rate and blood pressure twice daily.',
      'Reduce EVA workload for 24 hours and monitor for symptoms.',
      'Increase fluid intake per standing flight rule FR-CARDIO-01.',
      'Notify crew medical officer if values remain elevated after 48 hours.',
    ],
    2: [
      'CONTACT GROUND IMMEDIATELY — cardiovascular emergency protocol active.',
      'Cease all strenuous activity; assume supine position.',
      'Measure and log vital signs every 15 minutes.',
      'Prepare medical kit per emergency cardiac procedure IFM-7140.',
      'Crew medical officer must evaluate within 30 minutes.',
    ],
  },
  msk: {
    0: [],
    1: [
      'Review and increase countermeasure exercise session duration.',
      'Confirm ARED and CEVIS resistance settings are at prescribed levels.',
      'Log any joint pain, muscle weakness, or balance disturbance.',
      'Consult ground exercise physiology team at next available comm window.',
    ],
    2: [
      'CONTACT GROUND IMMEDIATELY — musculoskeletal emergency protocol active.',
      'Cease resistance exercises; switch to low-impact range-of-motion only.',
      'Immobilize any painful limb and document onset and severity.',
      'Flight surgeon to review bone/muscle status before next EVA clearance.',
    ],
  },
  immune: {
    0: [],
    1: [
      'Monitor for new or worsening symptoms twice daily.',
      'Wash hands and high-touch surfaces per infection-control checklist.',
      'Increase sleep duration to ≥7 hours to support immune function.',
      'Notify crew medical officer if fever develops or symptoms worsen.',
    ],
    2: [
      'CONTACT GROUND IMMEDIATELY — immune/infection emergency protocol active.',
      'Isolate symptomatic crew member per contingency quarantine procedure.',
      'Take temperature every 2 hours and log all symptoms.',
      'Prepare medical kit per infection IFM-7050; await flight surgeon guidance.',
    ],
  },
  behav: {
    0: [],
    1: [
      'Schedule a voluntary check-in with the crew behavioral health officer.',
      'Prioritize 7–8 hours of sleep; use blue-light blocker 1 hour before sleep.',
      'Practice structured decompression time (20 min off-duty mindfulness).',
      'Review workload schedule with ground ops to redistribute tasks if needed.',
    ],
    2: [
      'CONTACT GROUND IMMEDIATELY — behavioral health emergency protocol active.',
      'Crew behavioral health officer to perform confidential 1-on-1 assessment.',
      'Temporarily reduce mission-critical task load with ground coordination.',
      'Increase scheduled communication with family/support persons.',
      'Flight surgeon and psychologist to review before resuming high-workload duties.',
    ],
  },
  env: {
    0: [],
    1: [
      'Verify CDRA (CO₂ removal) and radiation monitoring systems are nominal.',
      'Log environmental readings every 4 hours for 48 hours.',
      'Check for localized radiation dose correlation with EVA or SPE event.',
      'Notify ground environmental systems team at next comm window.',
    ],
    2: [
      'CONTACT GROUND IMMEDIATELY — environmental hazard emergency protocol active.',
      'If radiation: shelter in storm shelter immediately per SPE emergency procedure.',
      'If CO₂: initiate emergency scrubbing protocol and don masks if available.',
      'All crew to consolidate in lowest-dose module until further instruction.',
      'Ground radiation safety officer to advise on exposure mitigation steps.',
    ],
  },
};

// ---- Public API ------------------------------------------------------------

export function getActions(domain: Domain, level: Level): string[] {
  return ACTIONS[domain][level] ?? [];
}

/**
 * getDeterministicGuidance — builds a full AssistantAnswer-shaped response from
 * the rules engine result alone.  Used when the LLM is unavailable or its output
 * is invalid (CLAUDE.md rule 3: final deterministic fallback).
 */
export function getDeterministicGuidance(result: AssessResult): {
  summary: string;
  explanation: string;
  steps: string[];
  escalate: boolean;
  sources: string[];
  fallback_used: true;
} {
  const escalate = result.overall === 2;

  // Pick the highest-level domains for a summary message.
  const elevated = result.domains
    .filter(d => d.level >= 1)
    .sort((a, b) => b.level - a.level);

  let summary: string;
  if (result.overall === 0) {
    summary = 'All systems nominal. No action required.';
  } else if (result.overall === 1) {
    const names = elevated.map(d => d.domain).join(', ');
    summary = `Watch advisory — elevated readings in: ${names}.`;
  } else {
    const names = elevated.map(d => d.domain).join(', ');
    summary = `ACTION REQUIRED — critical readings in: ${names}. Contact ground immediately.`;
  }

  const firstElevated = elevated[0];
  const explanation =
    result.multi_domain
      ? 'Multiple health domains are affected simultaneously, which may indicate a systemic issue. Ground consultation is recommended.'
      : firstElevated !== undefined
        ? `The ${firstElevated.domain} domain shows values outside nominal range. Follow the guidance steps below.`
        : 'All monitored metrics are within acceptable range based on mission thresholds.';

  // Collect unique steps from all elevated domains, highest level first.
  const steps: string[] = [];
  for (const ds of elevated) {
    for (const step of getActions(ds.domain, ds.level)) {
      if (!steps.includes(step)) steps.push(step);
    }
  }

  return {
    summary,
    explanation,
    steps: steps.slice(0, 5),
    escalate,
    sources: ['engine/actions.ts (deterministic fallback)'],
    fallback_used: true,
  };
}
