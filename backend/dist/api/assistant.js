import rateLimit from '@fastify/rate-limit';
import { ask, AskRequestSchema } from '../llm/service.js';
export const assistantRoute = async (app, opts) => {
    const { config, db } = opts.deps;
    // Tighter rate limit for the LLM endpoint (RESTRICTIONS.md §4)
    await app.register(rateLimit, {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip,
    });
    app.post('/astronauts/:id/assistant', async (req, reply) => {
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
    });
};
//# sourceMappingURL=assistant.js.map