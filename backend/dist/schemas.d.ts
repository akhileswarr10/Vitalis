/**
 * schemas.ts – shared Zod schemas for requests, responses, and DB row types.
 * Per-metric ranges are identical to the SQL check constraints in supabase/migrations/0001_init.sql.
 */
import { z } from 'zod';
export { z };
export declare const AstronautSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    created_at: string;
}, {
    id: string;
    label: string;
    created_at: string;
}>;
export type Astronaut = z.infer<typeof AstronautSchema>;
export declare const AstronautCreateSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
}, {
    id: string;
    label: string;
}>;
export type AstronautCreate = z.infer<typeof AstronautCreateSchema>;
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
export declare const CheckInCreateSchema: z.ZodObject<{
    day: z.ZodNumber;
    hr: z.ZodNumber;
    sbp: z.ZodNumber;
    ortho: z.ZodNumber;
    ex: z.ZodNumber;
    bone: z.ZodNumber;
    temp: z.ZodNumber;
    sym: z.ZodNumber;
    sleep: z.ZodNumber;
    mood: z.ZodNumber;
    stress: z.ZodNumber;
    dose: z.ZodNumber;
    co2: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    day: number;
    hr: number;
    sbp: number;
    ortho: number;
    ex: number;
    bone: number;
    temp: number;
    sym: number;
    sleep: number;
    mood: number;
    stress: number;
    dose: number;
    co2: number;
}, {
    day: number;
    hr: number;
    sbp: number;
    ortho: number;
    ex: number;
    bone: number;
    temp: number;
    sym: number;
    sleep: number;
    mood: number;
    stress: number;
    dose: number;
    co2: number;
}>;
export type CheckInCreate = z.infer<typeof CheckInCreateSchema>;
export declare const CheckInSchema: z.ZodObject<{
    day: z.ZodNumber;
    hr: z.ZodNumber;
    sbp: z.ZodNumber;
    ortho: z.ZodNumber;
    ex: z.ZodNumber;
    bone: z.ZodNumber;
    temp: z.ZodNumber;
    sym: z.ZodNumber;
    sleep: z.ZodNumber;
    mood: z.ZodNumber;
    stress: z.ZodNumber;
    dose: z.ZodNumber;
    co2: z.ZodNumber;
} & {
    id: z.ZodNumber;
    astronaut_id: z.ZodString;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: number;
    created_at: string;
    day: number;
    hr: number;
    sbp: number;
    ortho: number;
    ex: number;
    bone: number;
    temp: number;
    sym: number;
    sleep: number;
    mood: number;
    stress: number;
    dose: number;
    co2: number;
    astronaut_id: string;
}, {
    id: number;
    created_at: string;
    day: number;
    hr: number;
    sbp: number;
    ortho: number;
    ex: number;
    bone: number;
    temp: number;
    sym: number;
    sleep: number;
    mood: number;
    stress: number;
    dose: number;
    co2: number;
    astronaut_id: string;
}>;
export type CheckIn = z.infer<typeof CheckInSchema>;
/** Helper to safely map database row records to typed CheckIn objects. */
export declare function mapCheckInRow(row: Record<string, unknown>): CheckIn;
export declare const AssistantLogSchema: z.ZodObject<{
    id: z.ZodNumber;
    astronaut_id: z.ZodString;
    question: z.ZodString;
    answer: z.ZodUnknown;
    model: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fallback_used: z.ZodBoolean;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: number;
    created_at: string;
    astronaut_id: string;
    question: string;
    fallback_used: boolean;
    answer?: unknown;
    model?: string | null | undefined;
}, {
    id: number;
    created_at: string;
    astronaut_id: string;
    question: string;
    fallback_used: boolean;
    answer?: unknown;
    model?: string | null | undefined;
}>;
export type AssistantLog = z.infer<typeof AssistantLogSchema>;
export declare const AssistantAnswerSchema: z.ZodObject<{
    summary: z.ZodString;
    explanation: z.ZodString;
    steps: z.ZodArray<z.ZodString, "many">;
    escalate: z.ZodBoolean;
    sources: z.ZodArray<z.ZodString, "many">;
    fallback_used: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fallback_used: boolean;
    summary: string;
    explanation: string;
    steps: string[];
    escalate: boolean;
    sources: string[];
}, {
    fallback_used: boolean;
    summary: string;
    explanation: string;
    steps: string[];
    escalate: boolean;
    sources: string[];
}>;
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;
//# sourceMappingURL=schemas.d.ts.map