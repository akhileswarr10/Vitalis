/**
 * engine.test.ts – Pure engine unit tests (no DB, no Fastify, no I/O).
 * Tests: every metric at each boundary, baseline fallback, drift, multi_domain, purity.
 */
import { describe, it, expect } from 'vitest';
import { assess, computeHrBaseline, type CheckInEntry, type MetricResult } from '../src/engine/evaluate.js';

// ---- Helpers ----------------------------------------------------------------

/** Build a minimal valid CheckInEntry with all metrics at safe "nominal" values. */
function nominal(overrides: Partial<CheckInEntry> = {}): CheckInEntry {
  return {
    day: 1,
    hr: 65,
    sbp: 120,
    ortho: 10,
    ex: 90,
    bone: 8,
    temp: 36.8,
    sym: 0,
    sleep: 7.5,
    mood: 7,
    stress: 3,
    dose: 0.3,
    co2: 500,
    ...overrides,
  };
}

/** Build an array of `n` entries where values change linearly per day. */
function series(n: number, overrides: Partial<CheckInEntry> = {}): CheckInEntry[] {
  return Array.from({ length: n }, (_, i) =>
    nominal({ day: i + 1, ...overrides }),
  );
}

/** Extract a metric result by key; throws if not found (keeps tests simple). */
function getMetric(results: MetricResult[], key: string): MetricResult {
  const m = results.find(r => r.key === key);
  if (m === undefined) throw new Error(`Metric "${key}" not found in results`);
  return m;
}

// ---- HR Baseline tests ------------------------------------------------------

describe('computeHrBaseline', () => {
  it('returns null for empty entries', () => {
    const { baseline, fallback } = computeHrBaseline([]);
    expect(baseline).toBeNull();
    expect(fallback).toBe(false);
  });

  it('falls back to latest HR when fewer than 3 entries', () => {
    const entries = [nominal({ day: 1, hr: 70 }), nominal({ day: 2, hr: 75 })];
    const { baseline, fallback } = computeHrBaseline(entries);
    expect(fallback).toBe(true);
    expect(baseline).toBe(75); // latest
  });

  it('uses mean of first 7 entries when >= 3 entries', () => {
    const entries = series(10, { hr: 60 }).map((e, i) => ({ ...e, hr: 60 + i }));
    // First 7: 60,61,62,63,64,65,66 → mean = 63
    const { baseline, fallback } = computeHrBaseline(entries);
    expect(fallback).toBe(false);
    expect(baseline).toBeCloseTo(63, 5);
  });

  it('uses mean of exactly 3 entries (not fallback)', () => {
    const entries = [
      nominal({ day: 1, hr: 60 }),
      nominal({ day: 2, hr: 70 }),
      nominal({ day: 3, hr: 80 }),
    ];
    const { baseline, fallback } = computeHrBaseline(entries);
    expect(fallback).toBe(false);
    expect(baseline).toBeCloseTo(70, 5);
  });
});

// ---- HR metric thresholds (baseline-relative) --------------------------------

describe('HR metric (baseline-relative)', () => {
  // Establish baseline = 65 bpm (mean of first 7, all hr=65).
  // watch offset = 15 → effectiveWatch = 80
  // action offset = 25 → effectiveAction = 90

  const baselineEntries = series(7, { hr: 65 });

  it('level 0: HR just below watch (baseline + 14)', () => {
    const entries = [...baselineEntries, nominal({ day: 8, hr: 79 })];
    const result = assess(entries);
    const hr = getMetric(result.metrics, 'hr');
    expect(hr.level).toBe(0);
    expect(hr.effectiveWatch).toBeCloseTo(80, 1);
  });

  it('level 1: HR at watch boundary (baseline + 15)', () => {
    const entries = [...baselineEntries, nominal({ day: 8, hr: 80 })];
    const result = assess(entries);
    const hr = getMetric(result.metrics, 'hr');
    expect(hr.level).toBe(1);
  });

  it('level 2: HR at action boundary (baseline + 25)', () => {
    const entries = [...baselineEntries, nominal({ day: 8, hr: 90 })];
    const result = assess(entries);
    const hr = getMetric(result.metrics, 'hr');
    expect(hr.level).toBe(2);
  });

  it('HR baseline fallback (<3 entries): uses latest HR value', () => {
    // 2 entries: latest hr = 70; effectiveWatch = 70+15 = 85
    const entries = [nominal({ day: 1, hr: 70 }), nominal({ day: 2, hr: 70, sbp: 100 })];
    const result = assess(entries);
    expect(result.hrBaselineFallback).toBe(true);
    const hr = getMetric(result.metrics, 'hr');
    expect(hr.effectiveWatch).toBeCloseTo(85, 1);
  });
});

// ---- SBP (cardio, higher_is_worse, absolute) ---------------------------------

describe('SBP metric', () => {
  it('level 0: sbp = 139', () => {
    expect(getMetric(assess([nominal({ sbp: 139 })]).metrics, 'sbp').level).toBe(0);
  });
  it('level 1: sbp = 140', () => {
    expect(getMetric(assess([nominal({ sbp: 140 })]).metrics, 'sbp').level).toBe(1);
  });
  it('level 2: sbp = 160', () => {
    expect(getMetric(assess([nominal({ sbp: 160 })]).metrics, 'sbp').level).toBe(2);
  });
});

// ---- Ortho (cardio, higher_is_worse) -----------------------------------------

describe('Ortho metric', () => {
  it('level 0: ortho = 19', () => {
    expect(getMetric(assess([nominal({ ortho: 19 })]).metrics, 'ortho').level).toBe(0);
  });
  it('level 1: ortho = 20', () => {
    expect(getMetric(assess([nominal({ ortho: 20 })]).metrics, 'ortho').level).toBe(1);
  });
  it('level 2: ortho = 30', () => {
    expect(getMetric(assess([nominal({ ortho: 30 })]).metrics, 'ortho').level).toBe(2);
  });
});

// ---- Exercise (msk, lower_is_worse) ------------------------------------------

describe('Exercise metric', () => {
  it('level 0: ex = 46', () => {
    expect(getMetric(assess([nominal({ ex: 46 })]).metrics, 'ex').level).toBe(0);
  });
  it('level 1: ex = 45', () => {
    expect(getMetric(assess([nominal({ ex: 45 })]).metrics, 'ex').level).toBe(1);
  });
  it('level 2: ex = 20', () => {
    expect(getMetric(assess([nominal({ ex: 20 })]).metrics, 'ex').level).toBe(2);
  });
});

// ---- Bone (msk, lower_is_worse) ----------------------------------------------

describe('Bone metric', () => {
  it('level 0: bone = 8', () => {
    expect(getMetric(assess([nominal({ bone: 8 })]).metrics, 'bone').level).toBe(0);
  });
  it('level 1: bone = 7', () => {
    expect(getMetric(assess([nominal({ bone: 7 })]).metrics, 'bone').level).toBe(1);
  });
  it('level 2: bone = 5', () => {
    expect(getMetric(assess([nominal({ bone: 5 })]).metrics, 'bone').level).toBe(2);
  });
});

// ---- Temperature (immune, higher_is_worse) -----------------------------------

describe('Temperature metric', () => {
  it('level 0: temp = 37.4', () => {
    expect(getMetric(assess([nominal({ temp: 37.4 })]).metrics, 'temp').level).toBe(0);
  });
  it('level 1: temp = 37.5', () => {
    expect(getMetric(assess([nominal({ temp: 37.5 })]).metrics, 'temp').level).toBe(1);
  });
  it('level 2: temp = 38.3', () => {
    expect(getMetric(assess([nominal({ temp: 38.3 })]).metrics, 'temp').level).toBe(2);
  });
});

// ---- Symptom Score (immune, higher_is_worse) ---------------------------------

describe('Symptom metric', () => {
  it('level 0: sym = 1', () => {
    expect(getMetric(assess([nominal({ sym: 1 })]).metrics, 'sym').level).toBe(0);
  });
  it('level 1: sym = 2', () => {
    expect(getMetric(assess([nominal({ sym: 2 })]).metrics, 'sym').level).toBe(1);
  });
  it('level 2: sym = 4', () => {
    expect(getMetric(assess([nominal({ sym: 4 })]).metrics, 'sym').level).toBe(2);
  });
});

// ---- Sleep (behav, lower_is_worse) -------------------------------------------

describe('Sleep metric', () => {
  it('level 0: sleep = 7.0', () => {
    expect(getMetric(assess([nominal({ sleep: 7.0 })]).metrics, 'sleep').level).toBe(0);
  });
  it('level 1: sleep = 6.5', () => {
    expect(getMetric(assess([nominal({ sleep: 6.5 })]).metrics, 'sleep').level).toBe(1);
  });
  it('level 2: sleep = 5.5', () => {
    expect(getMetric(assess([nominal({ sleep: 5.5 })]).metrics, 'sleep').level).toBe(2);
  });
});

// ---- Mood (behav, lower_is_worse) --------------------------------------------

describe('Mood metric', () => {
  it('level 0: mood = 6', () => {
    expect(getMetric(assess([nominal({ mood: 6 })]).metrics, 'mood').level).toBe(0);
  });
  it('level 1: mood = 5', () => {
    expect(getMetric(assess([nominal({ mood: 5 })]).metrics, 'mood').level).toBe(1);
  });
  it('level 2: mood = 3', () => {
    expect(getMetric(assess([nominal({ mood: 3 })]).metrics, 'mood').level).toBe(2);
  });
});

// ---- Stress (behav, higher_is_worse) ----------------------------------------

describe('Stress metric', () => {
  it('level 0: stress = 5', () => {
    expect(getMetric(assess([nominal({ stress: 5 })]).metrics, 'stress').level).toBe(0);
  });
  it('level 1: stress = 6', () => {
    expect(getMetric(assess([nominal({ stress: 6 })]).metrics, 'stress').level).toBe(1);
  });
  it('level 2: stress = 8', () => {
    expect(getMetric(assess([nominal({ stress: 8 })]).metrics, 'stress').level).toBe(2);
  });
});

// ---- Radiation Dose (env, higher_is_worse) -----------------------------------

describe('Radiation dose metric', () => {
  it('level 0: dose = 0.5', () => {
    expect(getMetric(assess([nominal({ dose: 0.5 })]).metrics, 'dose').level).toBe(0);
  });
  it('level 1: dose = 1.0', () => {
    expect(getMetric(assess([nominal({ dose: 1.0 })]).metrics, 'dose').level).toBe(1);
  });
  it('level 2: dose = 5.0', () => {
    expect(getMetric(assess([nominal({ dose: 5.0 })]).metrics, 'dose').level).toBe(2);
  });
});

// ---- CO2 (env, higher_is_worse) ---------------------------------------------

describe('CO2 metric', () => {
  it('level 0: co2 = 800', () => {
    expect(getMetric(assess([nominal({ co2: 800 })]).metrics, 'co2').level).toBe(0);
  });
  it('level 1: co2 = 1000', () => {
    expect(getMetric(assess([nominal({ co2: 1000 })]).metrics, 'co2').level).toBe(1);
  });
  it('level 2: co2 = 5000', () => {
    expect(getMetric(assess([nominal({ co2: 5000 })]).metrics, 'co2').level).toBe(2);
  });
});

// ---- Overall + Domain aggregation -------------------------------------------

describe('Overall and domain aggregation', () => {
  it('overall is max across all domains', () => {
    // co2 at action level (env domain level 2)
    const result = assess([nominal({ co2: 5000 })]);
    expect(result.overall).toBe(2);
    const env = result.domains.find(d => d.domain === 'env');
    expect(env).toBeDefined();
    expect(env?.level).toBe(2);
  });

  it('all nominal → overall level 0', () => {
    const result = assess([nominal()]);
    expect(result.overall).toBe(0);
  });
});

// ---- multi_domain flag -------------------------------------------------------

describe('multi_domain flag', () => {
  it('false when only 1 domain is elevated', () => {
    const result = assess([nominal({ co2: 1000 })]); // only env elevated
    expect(result.multi_domain).toBe(false);
  });

  it('true when 2+ domains are elevated', () => {
    // env (co2 level 1) + cardio (sbp level 1)
    const result = assess([nominal({ co2: 1000, sbp: 140 })]);
    expect(result.multi_domain).toBe(true);
  });

  it('true when 3 domains are elevated', () => {
    const result = assess([nominal({ co2: 1000, sbp: 140, sleep: 6.5 })]);
    expect(result.multi_domain).toBe(true);
  });
});

// ---- Drift detection --------------------------------------------------------

describe('Drift detection', () => {
  /**
   * Sleep declining series: 20 entries.
   * Days 1–14: sleep = 8.0 (well above watch 6.5, so level 0 throughout).
   * Days 15–20: sleep drops 0.2/day: 7.8, 7.6, 7.4, 7.2, 7.0, 6.8.
   *   → all still > 6.5 (watch threshold) → level 0 on last day.
   * last3 (days 18–20): [7.2, 7.0, 6.8] mean ≈ 7.0
   * prev14 (days 4–17): [8.0×11, 7.8, 7.6, 7.4] mean ≈ 7.89
   * diff ≈ -0.89 > drift_tolerance 0.5 → drift fires ✓
   */
  function sleepDeclineSeries(): CheckInEntry[] {
    return Array.from({ length: 20 }, (_, i) => {
      const day = i + 1;
      const sleep = day <= 14 ? 8.0 : 8.0 - (day - 14) * 0.2;
      return nominal({ day, sleep });
    });
  }

  it('drift fires when >= 8 entries, bad direction, exceeds tolerance, metric at level 0', () => {
    const entries = sleepDeclineSeries();
    const result = assess(entries);
    const sleepResult = getMetric(result.metrics, 'sleep');
    expect(sleepResult.drift).toBeDefined();
    expect(sleepResult.drift?.direction).toBe('down');
  });

  it('drift does NOT fire with fewer than 8 entries', () => {
    const entries = sleepDeclineSeries().slice(0, 7);
    const result = assess(entries);
    const sleepResult = getMetric(result.metrics, 'sleep');
    expect(sleepResult.drift).toBeUndefined();
  });

  it('drift does NOT fire when metric is already at level >= 1', () => {
    // 20 entries, last 3 days sleep at level 1 (6.5) or level 2 (5.5)
    const entries = Array.from({ length: 20 }, (_, i) => {
      const day = i + 1;
      // Last 3 days: sleep = 6.3 (between action 5.5 and watch 6.5 → level 1)
      const sleep = day > 17 ? 6.3 : 7.5;
      return nominal({ day, sleep });
    });
    const result = assess(entries);
    const sleepResult = getMetric(result.metrics, 'sleep');
    expect(sleepResult.level).toBeGreaterThan(0);
    expect(sleepResult.drift).toBeUndefined();
  });

  it('drift fires for rising bad metric (higher_is_worse)', () => {
    // co2 rising from 500 to > 600 drift over last 3 days
    const entries = Array.from({ length: 20 }, (_, i) => {
      const day = i + 1;
      const co2 = day <= 14 ? 500 : 500 + (day - 14) * 60; // rises ~60 ppm/day
      return nominal({ day, co2 });
    });
    const result = assess(entries);
    const co2Result = getMetric(result.metrics, 'co2');
    // last 3 mean ~ 860, prev14 mean = 500, diff = 360 >> tolerance 100
    expect(co2Result.drift).toBeDefined();
    expect(co2Result.drift?.direction).toBe('up');
  });
});

// ---- Engine purity ----------------------------------------------------------

describe('Engine purity', () => {
  it('same input always produces same output', () => {
    const entries = series(10);
    const r1 = assess(entries);
    const r2 = assess(entries);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('does not mutate the input array', () => {
    const entries = series(5);
    const original = entries.map(e => e.day);
    assess(entries);
    expect(entries.map(e => e.day)).toEqual(original);
  });

  it('assess([]) returns overall level 0 and null hrBaseline', () => {
    const result = assess([]);
    expect(result.overall).toBe(0);
    expect(result.hrBaseline).toBeNull();
    expect(result.multi_domain).toBe(false);
  });
});
