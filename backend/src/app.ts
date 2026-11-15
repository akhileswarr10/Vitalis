/**
 * app.ts – build the Fastify application without starting to listen.
 * Tests call buildApp() and use fastify.inject(); server.ts calls it then listens.
 *
 * Dependency-injection pattern: all external resources (db, config) are passed
 * in as deps so tests can substitute PGlite and mocked config freely.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { loadConfig, type Config } from './config.js';
import { createDb, type Db } from './db.js';
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
    rewriteUrl(req) {
      const url = req.url ?? '';
      if (url && !url.startsWith('/api') && url !== '/') {
        return '/api' + (url.startsWith('/') ? url : '/' + url);
      }
      return url;
    },
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

// ---- Serverless Default Handler for Vercel ----
// When Vercel deploys Fastify, its zero-config preset maps src/app.ts (or app.js).
// Providing the default export here ensures Vercel can run requests through app.inject().
let appPromise: ReturnType<typeof buildApp> | null = null;

async function getAppInstance() {
  if (!appPromise) {
    appPromise = (async () => {
      const config = loadConfig(process.env);
      const db = await createDb(config.DATABASE_URL);
      const app = await buildApp({ config, db });
      await app.ready();
      return app;
    })().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

async function readBody(req: IncomingMessage): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if ('body' in req && (req as { body?: unknown }).body !== undefined) {
    const b = (req as { body: unknown }).body;
    return typeof b === 'string' ? b : JSON.stringify(b);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getAppInstance();
    const payload = await readBody(req);

    const response = await app.inject({
      method: req.method as any,
      url: req.url || '/',
      headers: req.headers as Record<string, string>,
      payload,
    });

    res.statusCode = response.statusCode;
    for (const [key, val] of Object.entries(response.headers)) {
      if (val !== undefined) {
        res.setHeader(key, val);
      }
    }
    res.end(response.rawPayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Fastify Vercel Handler Error:', message, stack);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          statusCode: 500,
          error: 'Internal Server Error',
          message,
        }),
      );
    }
  }
}


