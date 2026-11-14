/**
 * test/report.test.ts – Acceptance tests for GET /api/astronauts/:id/report
 *
 * Verifies:
 * - Nominal plain-text report generation
 * - Level-2 emergency case (must contain ACTION NEEDED, CONTACT GROUND IMMEDIATELY, disclaimer, reasons)
 * - 404 for unknown astronaut
 * - Purity and required disclaimers per CLAUDE.md & RESTRICTIONS.md
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp, type AppDeps } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { astronautsRepo } from '../src/repo/astronauts.js';
import { checkInsRepo } from '../src/repo/checkIns.js';
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

const nominalEntry = {
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
  dose: 0.35,
  co2: 500,
};

describe('GET /api/astronauts/:id/report', () => {
  let app: FastifyInstance;
  let deps: AppDeps;

  beforeAll(async () => {
    const config = loadConfig(TEST_ENV);
    const db = await createDb('pglite://memory');
    deps = { config, db };
    app = await buildApp(deps);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 when astronaut does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/astronauts/unknown-crew/report',
    });
    expect(res.statusCode).toBe(404);
  });

  it('generates a plain-text ground report for a nominal astronaut', async () => {
    await astronautsRepo.ensure(deps.db, { id: 'astro-nominal', label: 'Nominal Test Crew' });
    await checkInsRepo.createOrUpdate(deps.db, 'astro-nominal', nominalEntry);

    const res = await app.inject({
      method: 'GET',
      url: '/api/astronauts/astro-nominal/report',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-disposition']).toContain('vitalis-report-astro-nominal.txt');

    const body = res.body;

    // Disclaimer presence
    expect(body).toContain('Decision support only. Not a medical device.');
    expect(body).toContain('Ground flight surgeon review required for all clinical countermeasures.');

    // Overall status nominal
    expect(body).toContain('OVERALL HEALTH STATUS : NOMINAL (Level 0)');
    expect(body).toContain('MULTI-DOMAIN ELEVATION: NO');

    // All domain names present
    expect(body).toContain('[CARDIO] Cardiovascular: NOMINAL (Level 0)');
    expect(body).toContain('[MSK] Musculoskeletal: NOMINAL (Level 0)');
    expect(body).toContain('[IMMUNE] Immune & Infection: NOMINAL (Level 0)');
    expect(body).toContain('[BEHAV] Behavioral & Cognitive: NOMINAL (Level 0)');
    expect(body).toContain('[ENV] Habitability & Environment: NOMINAL (Level 0)');

    // Latest values section contains metrics
    expect(body).toContain('hr');
    expect(body).toContain('sbp');
    expect(body).toContain('co2');
    expect(body).toContain('All parameters within nominal operational limits.');
  });

  it('covers a level-2 case with critical status, reasons, and immediate ground contact protocol', async () => {
    await astronautsRepo.ensure(deps.db, { id: 'astro-level2', label: 'Emergency Test Crew' });

    // Insert baseline check-ins days 1-3
    for (let d = 1; d <= 3; d++) {
      await checkInsRepo.createOrUpdate(deps.db, 'astro-level2', {
        ...nominalEntry,
        day: d,
      });
    }

    // Day 4: critical radiation spike (dose = 15 mGy/day, threshold action is >= 5.0 mGy)
    // and severe hypoxia/CO2 spike (co2 = 6000 ppm, threshold action is >= 5000 ppm)
    await checkInsRepo.createOrUpdate(deps.db, 'astro-level2', {
      ...nominalEntry,
      day: 4,
      dose: 15,
      co2: 6000,
      hr: 115, // HR > baseline(70) + 35 -> level 2
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/astronauts/astro-level2/report',
    });

    expect(res.statusCode).toBe(200);
    const body = res.body;

    // Must show Level 2 overall status
    expect(body).toContain('OVERALL HEALTH STATUS : ACTION NEEDED (Level 2)');
    expect(body).toContain('MULTI-DOMAIN ELEVATION: YES');

    // Must show emergency alert and contact ground immediately
    expect(body).toContain('*** EMERGENCY ACTION REQUIRED (LEVEL 2 CRITICAL STATUS) ***');
    expect(body).toContain('CONTACT GROUND IMMEDIATELY');

    // Must identify the flagged reasons with action thresholds
    expect(body).toContain('ACTION threshold reached');
    expect(body).toContain('dose');
    expect(body).toContain('co2');

    // Must contain latest values
    expect(body).toContain('15');
    expect(body).toContain('6000');

    // Must contain mandatory disclaimers
    expect(body).toContain('Decision support only. Not a medical device.');
  });
});
