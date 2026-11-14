/**
 * test/seed.test.ts – Tests for POST /api/demo/seed:
 * - 403 Forbidden in production environment
 * - 201 Created in development environment with 30 days of synthetic data
 * - Verifies day 18+ decline in sleep, mood, exercise and day 22 radiation spike
 */
import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';

describe('Demo Seed API', () => {
  it('returns 403 Forbidden when APP_ENV=production', async () => {
    const prodEnv: NodeJS.ProcessEnv = {
      APP_ENV: 'production',
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

    const config = loadConfig(prodEnv);
    const db = await createDb(config.DATABASE_URL);
    const app = await buildApp({ config, db });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/demo/seed',
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBe('Forbidden');
    } finally {
      await app.close();
      await db.close();
    }
  });

  it('populates crew-01 with 30 days of synthetic data in development mode', async () => {
    const devEnv: NodeJS.ProcessEnv = {
      APP_ENV: 'development',
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

    const config = loadConfig(devEnv);
    const db = await createDb(config.DATABASE_URL);
    const app = await buildApp({ config, db });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/demo/seed',
      });
      expect(res.statusCode).toBe(201);
      const seedBody = JSON.parse(res.body) as { status: string; astronaut_id: string; days_seeded: number };
      expect(seedBody.status).toBe('seeded');
      expect(seedBody.astronaut_id).toBe('crew-01');
      expect(seedBody.days_seeded).toBe(30);

      // Verify the seeded check-in history
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/astronauts/crew-01/checkins',
      });
      expect(listRes.statusCode).toBe(200);
      const checkIns = JSON.parse(listRes.body) as Array<{
        day: number;
        sleep: number;
        mood: number;
        ex: number;
        dose: number;
      }>;
      expect(checkIns).toHaveLength(30);

      // Verify days 1–17 baseline
      const day1 = checkIns.find(c => c.day === 1);
      expect(day1?.sleep).toBe(7.8);
      expect(day1?.mood).toBe(8);
      expect(day1?.ex).toBe(60);
      expect(day1?.dose).toBe(0.35);

      // Verify day 18+ decline
      const day25 = checkIns.find(c => c.day === 25);
      expect(day25?.sleep).toBeLessThan(6.0);
      expect(day25?.mood).toBeLessThan(6);
      expect(day25?.ex).toBeLessThan(40);

      // Verify day 22 radiation spike
      const day22 = checkIns.find(c => c.day === 22);
      expect(day22?.dose).toBe(8.5);

      // Verify days around day 22 have normal dose
      const day21 = checkIns.find(c => c.day === 21);
      const day23 = checkIns.find(c => c.day === 23);
      expect(day21?.dose).toBeLessThan(1.0);
      expect(day23?.dose).toBeLessThan(1.0);

      // Verify seed is idempotent (re-running updates 30 days without error)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/demo/seed',
      });
      expect(res2.statusCode).toBe(201);
    } finally {
      await app.close();
      await db.close();
    }
  });
});

