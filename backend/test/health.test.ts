/**
 * test/health.test.ts – Prompt 1 acceptance criteria:
 * GET /api/health works against PGlite in-memory (no real Supabase or Groq needed).
 *
 * Uses fastify.inject() – no listening port required.
 * RESTRICTIONS.md §5: "Tests/CI must not require real Supabase or Groq accounts."
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp, type AppDeps } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import type { FastifyInstance } from 'fastify';

// Minimal env override: PGlite for DB, no Groq key → llm_available will be false
const TEST_ENV: NodeJS.ProcessEnv = {
  APP_ENV: 'test',
  PORT: '8000',
  CORS_ORIGINS: 'http://localhost:5173',
  RATE_LIMIT_PER_MINUTE: '1000', // generous in tests
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

describe('GET /api/health', () => {
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

  it('returns 200 with status "ok"', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('reports database_ok: true (PGlite in-memory)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body) as { status: string; database_ok: boolean; llm_available: boolean };
    expect(body.status).toBe('ok');
    expect(body.database_ok).toBe(true);
  });

  it('reports llm_available: false when GROQ_API_KEY is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body) as { status: string; database_ok: boolean; llm_available: boolean };
    expect(body.llm_available).toBe(false);
  });

  it('response has the correct shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('database_ok');
    expect(body).toHaveProperty('llm_available');
  });
});

