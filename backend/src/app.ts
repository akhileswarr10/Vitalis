/**
 * app.ts – build the Fastify application without starting to listen.
 * Tests call buildApp() and use fastify.inject(); server.ts calls it then listens.
 *
 * Dependency-injection pattern: all external resources (db, config) are passed
 * in as deps so tests can substitute PGlite and mocked config freely.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { healthRoute } from './api/health.js';
import { checkinsRoute } from './api/checkins.js';
import { demoRoute } from './api/demo.js';
import { statusRoute } from './api/status.js';
import { trendsRoute } from './api/trends.js';
import { assistantRoute } from './api/assistant.js';
import { reportRoute } from './api/report.js';
import { spaceWeatherRoute } from './api/spaceWeather.js';
import { checkModelAvailability } from './llm/service.js';

export interface AppDeps {
  config: Config;
  db: Db;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;

  const app = Fastify({
    logger:
      config.APP_ENV === 'test'
        ? { level: 'silent' }
        : {
            level: config.APP_ENV === 'production' ? 'info' : 'debug',
            // RESTRICTIONS.md §4: redact API keys, tokens, and credentials from logs
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers["x-api-key"]',
                'req.headers["api-key"]',
                'req.query.api_key',
                'req.query.apiKey',
                '*.api_key',
                '*.apiKey',
                '*.GROQ_API_KEY',
                '*.NASA_API_KEY',
                '*.DATABASE_URL',
              ],
              censor: '[REDACTED]',
            },
          },
  });

  // ---- CORS ----
  // CLAUDE.md rule 6: frontend only calls our backend, never Groq/Supabase.
  const allowedOrigins = config.CORS_ORIGINS.split(',').map(s => s.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  });

  // ---- Rate limiting ----
  // Global limit now; Prompt 6 adds a tighter limit on /api/assistant.
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    // Don't rate-limit health probes
    skipOnError: true,
  });

  // ---- URL normalization ----
  // Ensures routes match whether reverse proxy forwards /api/... or strips it
  app.addHook('onRequest', async (req) => {
    if (req.raw.url && !req.raw.url.startsWith('/api')) {
      req.raw.url = '/api' + (req.raw.url.startsWith('/') ? req.raw.url : '/' + req.raw.url);
    }
  });

  // ---- Routes ----
  await app.register(healthRoute, { prefix: '/api', deps });
  await app.register(checkinsRoute, { prefix: '/api', deps });
  await app.register(demoRoute, { prefix: '/api', deps });
  await app.register(statusRoute, { prefix: '/api', deps });
  await app.register(trendsRoute, { prefix: '/api', deps });
  await app.register(assistantRoute, { prefix: '/api', deps });
  await app.register(reportRoute, { prefix: '/api', deps });
  await app.register(spaceWeatherRoute, { prefix: '/api', deps });

  // Check LLM model availability at startup (non-fatal)
  checkModelAvailability(config).catch(() => { /* non-fatal */ });

  return app;
}

