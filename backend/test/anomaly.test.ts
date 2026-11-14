/**
 * anomaly.test.ts – Unit and API tests for the rolling z-score anomaly detector.
 *
 * Verifies:
 * 1. Rolling z-score window (14) and minimum points (10).
 * 2. Flags advisory anomalies for |z| >= 2.5 with {metric, z, direction}.
 * 3. Crucial constraint: anomalies appear for synthetic spikes but NEVER change any level.
 * 4. GET /api/astronauts/:id/status returns anomalies in the "anomalies" field.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { detectAnomalies, type AnomalyFlag } from '../src/engine/anomaly.js';
import { assess, type CheckInEntry } from '../src/engine/evaluate.js';
import { buildApp, type AppDeps } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';

// ---- Helpers ----

function nominal(overrides: Partial<CheckInEntry> = {}): CheckInEntry {
  return {
    day: 1,
    hr: 65,
    sbp: 110,
    ortho: 10,
    ex: 90,
    bone: 8,
    temp: 36.6,
    sym: 0,
    sleep: 8.0,
    mood: 8,
    stress: 2,
    dose: 0.3,
    co2: 500,
    ...overrides,
  };
}

function series(count: number, base: Partial<CheckInEntry> = {}): CheckInEntry[] {
  return Array.from({ length: count }, (_, i) => nominal({ day: i + 1, ...base }));
}

// ---- Unit Tests ----

describe('Anomaly Detector (engine/anomaly.ts)', () => {
  it('returns empty array when entries count is less than minPoints (10)', () => {
    const entries = series(9);
    // Even with a spike on day 9, minPoints is not met
    const last = entries[entries.length - 1];
    if (last) last.sbp = 135;

    const flags = detectAnomalies(entries);
    expect(flags).toEqual([]);
  });

  it('returns empty array when all metrics are nominal and stable', () => {
    const entries = series(14);
    const flags = detectAnomalies(entries);
    expect(flags).toEqual([]);
  });

  it('detects an upward spike with |z| >= 2.5 and direction "up"', () => {
    // 13 days of sbp: 110, day 14 spikes to 135
    const entries = series(13, { sbp: 110 });
    entries.push(nominal({ day: 14, sbp: 135 }));

    const flags = detectAnomalies(entries);
    const sbpFlag = flags.find((f: AnomalyFlag) => f.metric === 'sbp');

    expect(sbpFlag).toBeDefined();
    expect(sbpFlag?.direction).toBe('up');
    expect(sbpFlag?.z).toBeGreaterThanOrEqual(2.5);
  });

  it('detects a downward dip with |z| >= 2.5 and direction "down"', () => {
    // 13 days of mood: 9, day 14 drops to 6
    const entries = series(13, { mood: 9 });
    entries.push(nominal({ day: 14, mood: 6 }));

    const flags = detectAnomalies(entries);
    const moodFlag = flags.find((f: AnomalyFlag) => f.metric === 'mood');

    expect(moodFlag).toBeDefined();
    expect(moodFlag?.direction).toBe('down');
    expect(moodFlag?.z).toBeLessThanOrEqual(-2.5);
  });

  it('CRUCIAL: synthetic spike generates an anomaly, but health levels remain UNCHANGED (level 0)', () => {
    // SBP watch threshold is 140. A jump from 110 to 135 is a huge statistical outlier,
    // but clinically it is still strictly below the 140 watch threshold.
    const entries = series(13, { sbp: 110 });
    entries.push(nominal({ day: 14, sbp: 135 }));

    // Assess via rules engine
    const assessResult = assess(entries);
    const sbpMetric = assessResult.metrics.find(m => m.key === 'sbp');

    // Rules engine says: level 0 (nominal)
    expect(sbpMetric).toBeDefined();
    expect(sbpMetric?.level).toBe(0);
    expect(assessResult.overall).toBe(0);

    // Anomaly detector says: anomaly detected!
    const anomalyFlags = detectAnomalies(entries);
    const sbpAnomaly = anomalyFlags.find(f => f.metric === 'sbp');

    expect(sbpAnomaly).toBeDefined();
    expect(sbpAnomaly?.direction).toBe('up');
    expect(sbpAnomaly?.z).toBeGreaterThanOrEqual(2.5);

    // Verify: presence of anomaly NEVER changes the health level
    expect(assessResult.overall).toBe(0);
    expect(sbpMetric?.level).toBe(0);
  });

  it('only evaluates the last `window` points (default 14)', () => {
    // History has 20 points.
    // Days 1-6 had a spike, but days 7-20 are all stable at 110.
    const entries = series(20, { sbp: 110 });
    const day2 = entries[1];
    if (day2) day2.sbp = 135;

    // The rolling window of size 14 looks at days 7-20, where sbp is flat at 110.
    const flags = detectAnomalies(entries);
    const sbpFlag = flags.find(f => f.metric === 'sbp');
    expect(sbpFlag).toBeUndefined();
  });
});

// ---- API Status Integration Test ----

const TEST_ENV: NodeJS.ProcessEnv = {
  APP_ENV: 'test',
  PORT: '8000',
  CORS_ORIGINS: 'http://localhost:5173',
  RATE_LIMIT_PER_MINUTE: '1000',
  DATABASE_URL: 'pglite://memory',
  GROQ_API_KEY: '',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  LLM_MODEL: 'openai/gpt-oss-20b',
  LLM_FALLBACK_MODEL: 'openai/gpt-oss-120b',
  LLM_REASONING_EFFORT: 'low',
  LLM_TIMEOUT_SECONDS: '30',
  LLM_MAX_TOKENS: '800',
  LLM_TEMPERATURE: '0.2',
  NASA_API_KEY: 'DEMO_KEY',
  SPACE_WEATHER_CACHE_MINUTES: '30',
};

describe('GET /api/astronauts/:id/status Anomaly Integration', () => {
  let app: FastifyInstance;
  let deps: AppDeps;

  beforeAll(async () => {
    const config = loadConfig(TEST_ENV);
    const db = await createDb(config.DATABASE_URL);
    deps = { config, db };
    app = await buildApp(deps);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await deps.db.close();
  });

  it('returns anomalies array and maintains nominal levels on synthetic spike', async () => {
    const astronautId = 'crew-anomaly-test';

    // Insert 13 baseline checkins
    for (let day = 1; day <= 13; day++) {
      const payload = nominal({ day, sbp: 110 });
      const res = await app.inject({
        method: 'POST',
        url: `/api/astronauts/${astronautId}/checkins`,
        payload,
      });
      expect(res.statusCode).toBe(201);
    }

    // Insert day 14 with SBP = 135 (spike below 140 watch)
    const spikePayload = nominal({ day: 14, sbp: 135 });
    const spikeRes = await app.inject({
      method: 'POST',
      url: `/api/astronauts/${astronautId}/checkins`,
      payload: spikePayload,
    });
    expect(spikeRes.statusCode).toBe(201);

    // Call GET /api/astronauts/:id/status
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/astronauts/${astronautId}/status`,
    });

    expect(statusRes.statusCode).toBe(200);
    const body = JSON.parse(statusRes.body);

    // Check anomalies field exists and contains sbp
    expect(Array.isArray(body.anomalies)).toBe(true);
    const sbpAnomaly = body.anomalies.find((a: { metric: string }) => a.metric === 'sbp');
    expect(sbpAnomaly).toBeDefined();
    expect(sbpAnomaly.direction).toBe('up');
    expect(sbpAnomaly.z).toBeGreaterThanOrEqual(2.5);

    // Check that levels are unchanged (overall level is 0, sbp level is 0)
    expect(body.overall).toBe(0);
    const sbpMetric = body.metrics.find((m: { key: string }) => m.key === 'sbp');
    expect(sbpMetric).toBeDefined();
    expect(sbpMetric.level).toBe(0);
  });
});

