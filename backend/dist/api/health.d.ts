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
type HealthOpts = {
    deps: AppDeps;
};
export declare const healthRoute: FastifyPluginAsync<HealthOpts>;
export {};
//# sourceMappingURL=health.d.ts.map