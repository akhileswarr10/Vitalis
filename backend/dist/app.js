/**
 * app.ts – build the Fastify application without starting to listen.
 * Tests call buildApp() and use fastify.inject(); server.ts calls it then listens.
 *
 * Dependency-injection pattern: all external resources (db, config) are passed
 * in as deps so tests can substitute PGlite and mocked config freely.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { healthRoute } from './api/health.js';
import { checkinsRoute } from './api/checkins.js';
import { demoRoute } from './api/demo.js';
import { statusRoute } from './api/status.js';
import { trendsRoute } from './api/trends.js';
import { assistantRoute } from './api/assistant.js';
import { reportRoute } from './api/report.js';
import { spaceWeatherRoute } from './api/spaceWeather.js';
import { checkModelAvailability } from './llm/service.js';
export async function buildApp(deps) {
    const { config } = deps;
    const app = Fastify({
        rewriteUrl(req) {
            const url = req.url ?? '';
            if (url && !url.startsWith('/api') && url !== '/') {
                return '/api' + (url.startsWith('/') ? url : '/' + url);
            }
            return url;
        },
        logger: config.APP_ENV === 'test'
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
            if (!origin)
                return cb(null, true);
            if (allowedOrigins.includes('*') ||
                allowedOrigins.includes(origin) ||
                origin.endsWith('.vercel.app')) {
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
    checkModelAvailability(config).catch(() => { });
    return app;
}
//# sourceMappingURL=app.js.map