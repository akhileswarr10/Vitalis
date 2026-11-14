import { CheckInCreateSchema } from '../schemas.js';
import { checkInsRepo } from '../repo/checkIns.js';
import { astronautsRepo } from '../repo/astronauts.js';
export const checkinsRoute = async (app, opts) => {
    const { db } = opts.deps;
    // ---- POST /api/astronauts/:id/checkins ----
    app.post('/astronauts/:id/checkins', async (req, reply) => {
        const astronautId = req.params.id;
        // Validate request body against Zod schema (matching SQL constraints exactly)
        const parseResult = CheckInCreateSchema.safeParse(req.body);
        if (!parseResult.success) {
            return reply.status(422).send({
                error: 'Validation Error',
                message: 'Invalid check-in metric values',
                details: parseResult.error.flatten().fieldErrors,
            });
        }
        // Ensure astronaut record exists so foreign key constraint holds
        await astronautsRepo.ensure(db, { id: astronautId, label: astronautId });
        // Idempotent upsert via ON CONFLICT (astronaut_id, day) DO UPDATE
        const checkIn = await checkInsRepo.createOrUpdate(db, astronautId, parseResult.data);
        return reply.status(201).send(checkIn);
    });
    // ---- GET /api/astronauts/:id/checkins ----
    app.get('/astronauts/:id/checkins', async (req, reply) => {
        const astronautId = req.params.id;
        const history = await checkInsRepo.findByAstronautId(db, astronautId);
        return reply.send(history);
    });
};
//# sourceMappingURL=checkins.js.map