import { astronautsRepo } from '../repo/astronauts.js';
import { checkInsRepo } from '../repo/checkIns.js';
export const demoRoute = async (app, opts) => {
    const { db, config } = opts.deps;
    app.post('/demo/seed', async (_req, reply) => {
        // CLAUDE.md / RESTRICTIONS.md: 403 in production
        if (config.APP_ENV === 'production') {
            return reply.status(403).send({
                error: 'Forbidden',
                message: 'Demo seed is disabled in production.',
            });
        }
        const astronautId = 'crew-01';
        await astronautsRepo.ensure(db, { id: astronautId, label: 'Astronaut Crew-01' });
        const body = (_req.body ?? {});
        const maxDay = typeof body.days === 'number' && body.days > 0 && body.days <= 30 ? body.days : 30;
        // Reset check-ins for clean re-seeding
        await db.query('DELETE FROM public.check_ins WHERE astronaut_id = $1;', [astronautId]);
        // Synthetic health indicators
        const checkIns = [];
        for (let day = 1; day <= maxDay; day++) {
            if (day < 18) {
                // Days 1–17: nominal baseline
                checkIns.push({
                    day,
                    hr: 66 + ((day * 3) % 5),
                    sbp: 116 + ((day * 2) % 6),
                    ortho: 6 + (day % 4),
                    ex: 60,
                    bone: 9,
                    temp: 36.6,
                    sym: 0,
                    sleep: 7.8,
                    mood: 8,
                    stress: 2,
                    dose: 0.35,
                    co2: 520 + (day % 30),
                });
            }
            else {
                // Days 18–30: slow hidden decline in sleep, mood, and exercise
                const daysIntoDecline = day - 17; // 1 to 13
                const sleep = Math.max(4.0, Number((7.8 - daysIntoDecline * 0.25).toFixed(1)));
                const mood = Math.max(2, 8 - Math.floor(daysIntoDecline * 0.4));
                const ex = Math.max(15, 60 - daysIntoDecline * 3);
                const stress = Math.min(8, 2 + Math.floor(daysIntoDecline * 0.5));
                // Day 22: radiation spike (e.g. solar flare particle event)
                const dose = day === 22 ? 8.5 : 0.4;
                checkIns.push({
                    day,
                    hr: 68 + (daysIntoDecline % 4),
                    sbp: 120 + (daysIntoDecline % 5),
                    ortho: 8 + (daysIntoDecline % 3),
                    ex,
                    bone: 9,
                    temp: 36.7,
                    sym: day > 25 ? 1 : 0,
                    sleep,
                    mood,
                    stress,
                    dose,
                    co2: 540 + (day % 40),
                });
            }
        }
        // Insert all 30 days idempotently
        for (const item of checkIns) {
            await checkInsRepo.createOrUpdate(db, astronautId, item);
        }
        return reply.status(201).send({
            status: 'seeded',
            astronaut_id: astronautId,
            days_seeded: checkIns.length,
        });
    });
};
//# sourceMappingURL=demo.js.map