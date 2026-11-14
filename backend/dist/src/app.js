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
export async function buildApp(deps) {
    const { config } = deps;
    const app = Fastify({
        logger: config.APP_ENV === 'test'
            ? { level: 'silent' }
            : {
                level: config.APP_ENV === 'production' ? 'info' : 'debug',
                // RESTRICTIONS.md §4: redact API key from logs (belt-and-suspenders)
                redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
            },
    });
    // ---- CORS ----
    // CLAUDE.md rule 6: frontend only calls our backend, never Groq/Supabase.
    await app.register(cors, {
        origin: config.CORS_ORIGINS.split(',').map(s => s.trim()),
        methods: ['GET', 'POST', 'OPTIONS'],
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
    return app;
}
//# sourceMappingURL=app.js.map