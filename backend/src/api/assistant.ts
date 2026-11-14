/**
 * api/assistant.ts – POST /api/astronauts/:id/assistant
 *
 * Rate-limited (tighter than global limit), validated with Zod.
 * All LLM logic lives in llm/service.ts. This route only handles HTTP concerns.
 */
import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { AppDeps } from '../app.js';
import { ask, AskRequestSchema } from '../llm/service.js';

interface AssistantRouteOpts {
  deps: AppDeps;
}

export const assistantRoute: FastifyPluginAsync<AssistantRouteOpts> = async (app, opts) => {
  const { config, db } = opts.deps;

  // Tighter rate limit for the LLM endpoint (RESTRICTIONS.md §4)
  await app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  app.post<{ Params: { id: string } }>(
    '/astronauts/:id/assistant',
    async (req, reply) => {
      const { id } = req.params;

      const parseResult = AskRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          error: 'Validation Error',
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const answer = await ask({
        config,
        db,
        astronautId: id,
        question: parseResult.data.question,
      });

      return reply.send(answer);
    },
  );
};

