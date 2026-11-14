/**
 * test/checkins.test.ts – Tests for check-in validation, upsert idempotency, and history listing.
 * Runs against in-memory PGlite with migrations applied.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp, type AppDeps } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import type { FastifyInstance } from 'fastify';

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

const validPayload = {
  day: 1,
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

describe('Check-in API endpoints', () => {
  let app: FastifyInstance;
  let deps: AppDeps;

  beforeAll(async () => {
    const config = loadConfig(TEST_ENV);
    const db = await createDb(config.DATABASE_URL);
    deps = { config, db };
    app = await buildApp(deps);
  });

  afterAll(async () => {
    await app.close();
    await deps.db.close();
  });

  it('rejects check-in with metrics outside SQL check constraint ranges with 422', async () => {
    const invalidPayload = {
      ...validPayload,
      hr: 250, // exceeds max 200
      temp: 45.0, // exceeds max 42
      co2: 200, // below min 300
      day: 0, // below min 1
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/astronauts/test-crew/checkins',
      payload: invalidPayload,
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body) as { error: string; details: Record<string, string[]> };
    expect(body.error).toBe('Validation Error');
    expect(body.details.hr).toBeDefined();
    expect(body.details.temp).toBeDefined();
    expect(body.details.co2).toBeDefined();
    expect(body.details.day).toBeDefined();
  });

  it('creates a valid check-in with 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/astronauts/test-crew/checkins',
      payload: validPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.astronaut_id).toBe('test-crew');
    expect(body.day).toBe(1);
    expect(body.hr).toBe(72);
  });

  it('is idempotent on (astronaut_id, day) via ON CONFLICT DO UPDATE', async () => {
    // Post updated values for the same astronaut on the same day
    const updatedPayload = {
      ...validPayload,
      hr: 85,
      sleep: 6.0,
      mood: 5,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/astronauts/test-crew/checkins',
      payload: updatedPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.astronaut_id).toBe('test-crew');
    expect(body.day).toBe(1);
    expect(body.hr).toBe(85);
    expect(body.sleep).toBe(6.0);
    expect(body.mood).toBe(5);

    // Verify there is still only one check-in for day 1
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/astronauts/test-crew/checkins',
    });
    const list = JSON.parse(listRes.body) as Array<{ day: number; hr: number }>;
    const day1Entries = list.filter(e => e.day === 1);
    expect(day1Entries).toHaveLength(1);
    expect(day1Entries[0]?.hr).toBe(85);
  });

  it('retrieves check-in history ordered chronologically by day', async () => {
    // Add day 2 and day 3
    await app.inject({
      method: 'POST',
      url: '/api/astronauts/test-crew/checkins',
      payload: { ...validPayload, day: 2, hr: 70 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/astronauts/test-crew/checkins',
      payload: { ...validPayload, day: 3, hr: 75 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/astronauts/test-crew/checkins',
    });

    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body) as Array<{ day: number }>;
    expect(list.length).toBeGreaterThanOrEqual(3);
    // Chronological order verification
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]?.day ?? 0;
      const curr = list[i]?.day ?? 0;
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

