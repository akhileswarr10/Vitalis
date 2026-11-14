/**
 * schemas.ts – shared Zod schemas for requests, responses, and DB row types.
 * Per-metric ranges are identical to the SQL check constraints in supabase/migrations/0001_init.sql.
 */
import { z } from 'zod';
export { z };
// ---- Astronaut -------------------------------------------------------------
export const AstronautSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    created_at: z.string(),
});
export const AstronautCreateSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
});
// ---- CheckIn ---------------------------------------------------------------
/**
 * Per-metric ranges identical to supabase/migrations/0001_init.sql check constraints:
 * - day >= 1
 * - hr between 30 and 200
 * - sbp between 60 and 220
 * - ortho between 0 and 80
 * - ex between 0 and 480
 * - bone between 0 and 10
 * - temp between 34 and 42
 * - sym between 0 and 6
 * - sleep between 0 and 16
 * - mood between 1 and 10
 * - stress between 0 and 10
 * - dose between 0 and 100
 * - co2 between 300 and 10000
 */
export const CheckInCreateSchema = z.object({
    day: z.number().int().min(1, 'day must be at least 1'),
    hr: z.number().int().min(30, 'hr must be between 30 and 200').max(200, 'hr must be between 30 and 200'),
    sbp: z.number().int().min(60, 'sbp must be between 60 and 220').max(220, 'sbp must be between 60 and 220'),
    ortho: z.number().int().min(0, 'ortho must be between 0 and 80').max(80, 'ortho must be between 0 and 80'),
    ex: z.number().int().min(0, 'ex must be between 0 and 480').max(480, 'ex must be between 0 and 480'),
    bone: z.number().int().min(0, 'bone must be between 0 and 10').max(10, 'bone must be between 0 and 10'),
    temp: z.number().min(34.0, 'temp must be between 34 and 42').max(42.0, 'temp must be between 34 and 42'),
    sym: z.number().int().min(0, 'sym must be between 0 and 6').max(6, 'sym must be between 0 and 6'),
    sleep: z.number().min(0, 'sleep must be between 0 and 16').max(16, 'sleep must be between 0 and 16'),
    mood: z.number().int().min(1, 'mood must be between 1 and 10').max(10, 'mood must be between 1 and 10'),
    stress: z.number().int().min(0, 'stress must be between 0 and 10').max(10, 'stress must be between 0 and 10'),
    dose: z.number().min(0, 'dose must be between 0 and 100').max(100, 'dose must be between 0 and 100'),
    co2: z.number().int().min(300, 'co2 must be between 300 and 10000').max(10000, 'co2 must be between 300 and 10000'),
});
export const CheckInSchema = CheckInCreateSchema.extend({
    id: z.number(),
    astronaut_id: z.string(),
    created_at: z.string(),
});
/** Helper to safely map database row records to typed CheckIn objects. */
export function mapCheckInRow(row) {
    return {
        id: Number(row.id),
        astronaut_id: String(row.astronaut_id),
        day: Number(row.day),
        hr: Number(row.hr),
        sbp: Number(row.sbp),
        ortho: Number(row.ortho),
        ex: Number(row.ex),
        bone: Number(row.bone),
        temp: Number(row.temp),
        sym: Number(row.sym),
        sleep: Number(row.sleep),
        mood: Number(row.mood),
        stress: Number(row.stress),
        dose: Number(row.dose),
        co2: Number(row.co2),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
}
// ---- AssistantLog ----------------------------------------------------------
export const AssistantLogSchema = z.object({
    id: z.number(),
    astronaut_id: z.string(),
    question: z.string(),
    answer: z.unknown(),
    model: z.string().nullable().optional(),
    fallback_used: z.boolean(),
    created_at: z.string(),
});
// ---- AssistantAnswer -------------------------------------------------------
export const AssistantAnswerSchema = z.object({
    summary: z.string(),
    explanation: z.string(),
    steps: z.array(z.string()).max(5),
    escalate: z.boolean(),
    sources: z.array(z.string()),
    fallback_used: z.boolean(),
});
//# sourceMappingURL=schemas.js.map