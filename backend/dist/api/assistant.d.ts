/**
 * api/assistant.ts – POST /api/astronauts/:id/assistant
 *
 * Rate-limited (tighter than global limit), validated with Zod.
 * All LLM logic lives in llm/service.ts. This route only handles HTTP concerns.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
interface AssistantRouteOpts {
    deps: AppDeps;
}
export declare const assistantRoute: FastifyPluginAsync<AssistantRouteOpts>;
export {};
//# sourceMappingURL=assistant.d.ts.map