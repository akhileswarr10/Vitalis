/**
 * schemas.ts – shared Zod schemas for requests, responses, and DB row types.
 * Prompt 2 adds CheckInCreate and the full row schemas.
 * Prompt 1 just establishes the module so imports don't break.
 */
import { z } from 'zod';
export { z };
export declare const AssistantAnswerSchema: z.ZodObject<{
    summary: z.ZodString;
    explanation: z.ZodString;
    steps: z.ZodArray<z.ZodString, "many">;
    escalate: z.ZodBoolean;
    sources: z.ZodArray<z.ZodString, "many">;
    fallback_used: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    summary: string;
    explanation: string;
    steps: string[];
    escalate: boolean;
    sources: string[];
    fallback_used: boolean;
}, {
    summary: string;
    explanation: string;
    steps: string[];
    escalate: boolean;
    sources: string[];
    fallback_used: boolean;
}>;
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;
//# sourceMappingURL=schemas.d.ts.map