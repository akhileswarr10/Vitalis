/**
 * test/spaceWeather.test.ts – Acceptance tests for NASA DONKI Space Weather Service & API.
 *
 * Prompt 10 Acceptance:
 * - MSW-mocked tests for:
 *   1. Success: fetches flares & CMEs, identifies strong events, links to radiation guide
 *   2. Rate limit: HTTP 429 returns { available: false }
 *   3. Timeout: AbortSignal triggers, returns { available: false }
 *   4. Cache hit: returns cached results without repeated external calls
 *   5. Engine independence: space weather never changes rules engine health levels
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDeps } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { clearSpaceWeatherCache, getSpaceWeather } from '../src/services/spaceWeather.js';
import { astronautsRepo } from '../src/repo/astronauts.js';
import { checkInsRepo } from '../src/repo/checkIns.js';

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
  NASA_API_KEY: 'TEST_NASA_KEY',
  SPACE_WEATHER_CACHE_MINUTES: '30',
};

const mockFlares = [
  {
    flrID: '2026-05-10T12:00:00-FLR-001',
    beginTime: '2026-05-10T11:45Z',
    peakTime: '2026-05-10T12:00Z',
    endTime: '2026-05-10T12:30Z',
    classType: 'X2.5',
    sourceLocation: 'N18E42',
    link: 'https://donki.nasa.gov/flr/1',
  },
];

const mockCmes = [
  {
    activityID: '2026-05-10T12:15:00-CME-001',
    startTime: '2026-05-10T12:15Z',
    sourceLocation: 'N18E42',
    cmeAnalyses: [
      {
        speed: 1250,
        type: 'C',
        isMostAccurate: true,
      },
    ],
    link: 'https://donki.nasa.gov/cme/1',
  },
];

let flrCallCount = 0;
let cmeCallCount = 0;

const server = setupServer(
  http.get('https://api.nasa.gov/DONKI/FLR', () => {
    flrCallCount++;
    return HttpResponse.json(mockFlares);
  }),
  http.get('https://api.nasa.gov/DONKI/CME', () => {
    cmeCallCount++;
    return HttpResponse.json(mockCmes);
  }),
);

describe('Space Weather Service & API (Prompt 10)', () => {
  let app: FastifyInstance;
  let deps: AppDeps;

  beforeAll(async () => {
    server.listen({ onUnhandledRequest: 'bypass' });
    const config = loadConfig(TEST_ENV);
    const db = await createDb('pglite://memory');
    deps = { config, db };
    app = await buildApp(deps);
  });

  afterAll(async () => {
    server.close();
    await app.close();
  });

  beforeEach(() => {
    clearSpaceWeatherCache();
    flrCallCount = 0;
    cmeCallCount = 0;
    server.resetHandlers();
  });

  afterEach(() => {
    clearSpaceWeatherCache();
  });

  it('success: fetches space weather, flags strong event, and links to radiation shelter guide', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/space-weather',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.available).toBe(true);
    expect(body.cached).toBe(false);
    expect(body.has_strong_event).toBe(true);
    expect(body.flares).toHaveLength(1);
    expect(body.flares[0].classType).toBe('X2.5');
    expect(body.cmes).toHaveLength(1);
    expect(body.cmes[0].speed).toBe(1250);
    expect(body.advisory).toContain('X2.5');
    expect(body.advisory).toContain('radiation-spe-shelter.md');
    expect(body.advisory).toContain('does not alter health telemetry levels');
  });

  it('rate limit: returns { available: false } on HTTP 429 without throwing', async () => {
    server.use(
      http.get('https://api.nasa.gov/DONKI/FLR', () => {
        return new HttpResponse('Rate limit exceeded', { status: 429 });
      }),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/space-weather',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.error).toContain('429');
  });

  it('timeout: returns { available: false } when DONKI request exceeds timeout threshold', async () => {
    server.use(
      http.get('https://api.nasa.gov/DONKI/FLR', async () => {
        await delay(300);
        return HttpResponse.json([]);
      }),
      http.get('https://api.nasa.gov/DONKI/CME', async () => {
        await delay(300);
        return HttpResponse.json([]);
      }),
    );

    // Call service with a very short timeout of 50ms to trigger AbortSignal
    const result = await getSpaceWeather(deps.config, { timeoutMs: 50 });
    expect(result.available).toBe(false);
  });

  it('cache hit: subsequent requests return cached data without extra network calls', async () => {
    // 1. Initial request (cache miss)
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/space-weather',
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().available).toBe(true);
    expect(res1.json().cached).toBe(false);
    expect(flrCallCount).toBe(1);
    expect(cmeCallCount).toBe(1);

    // 2. Second request immediately (cache hit)
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/space-weather',
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().available).toBe(true);
    expect(res2.json().cached).toBe(true);

    // Network call count should remain 1
    expect(flrCallCount).toBe(1);
    expect(cmeCallCount).toBe(1);
  });

  it('engine purity: space weather alerts NEVER alter engine health levels', async () => {
    await astronautsRepo.ensure(deps.db, { id: 'astro-sw-test', label: 'Space Weather Test Crew' });
    await checkInsRepo.createOrUpdate(deps.db, 'astro-sw-test', {
      day: 1,
      hr: 70,
      sbp: 120,
      ortho: 10,
      ex: 60,
      bone: 8,
      temp: 36.6,
      sym: 0,
      sleep: 8.0,
      mood: 8,
      stress: 2,
      dose: 0.35, // Nominal radiation reading in habitat
      co2: 500,
    });

    // Space weather reports severe X-class flare and CME
    const swRes = await app.inject({
      method: 'GET',
      url: '/api/space-weather',
    });
    expect(swRes.json().has_strong_event).toBe(true);

    // Health status remains purely nominal (level 0) decided by rules engine
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/astronauts/astro-sw-test/status',
    });
    expect(statusRes.statusCode).toBe(200);
    const status = statusRes.json();
    expect(status.overall).toBe(0);

    const envDomain = status.domains.find((d: { domain: string }) => d.domain === 'env');
    expect(envDomain.level).toBe(0);
  });
});

