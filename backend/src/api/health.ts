/**
 * api/health.ts – GET /api/health
 *
 * Returns:  { status: "ok", database_ok: boolean, llm_available: boolean }
 * - database_ok: can the backend reach Supabase / PGlite?
 * - llm_available: is LLM_MODEL in Groq's /models list (and is GROQ_API_KEY set)?
 *
 * RESTRICTIONS.md §2: model ids are validated against Groq /models at startup
 * and on every health probe. No keys are logged.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';

interface GroqModelsResponse {
  data: Array<{ id: string }>;
}

type HealthOpts = { deps: AppDeps };

export const healthRoute: FastifyPluginAsync<HealthOpts> = async (app, opts) => {
  const { db, config } = opts.deps;

  app.get('/health', async (_req, reply) => {
    // ---- Database probe ----
    let database_ok = false;
    try {
      await db.query('SELECT 1');
      database_ok = true;
    } catch {
      database_ok = false;
    }

    // ---- LLM availability probe ----
    let llm_available = false;
    if (config.GROQ_API_KEY) {
      try {
        const res = await fetch(`${config.GROQ_BASE_URL}/models`, {
          headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` },
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) {
          const data = (await res.json()) as GroqModelsResponse;
          llm_available = data.data.some(m => m.id === config.LLM_MODEL);
        }
      } catch {
        llm_available = false;
      }
    }

    return reply.send({ status: 'ok', database_ok, llm_available });
  });
};

