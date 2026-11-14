/**
 * schemas.ts – shared Zod schemas for requests, responses, and DB row types.
 * Prompt 2 adds CheckInCreate and the full row schemas.
 * Prompt 1 just establishes the module so imports don't break.
 */
import { z } from 'zod';
// Re-export z so callers don't need to import it separately
export { z };
// AssistantAnswer – defined here so health.ts can reference it in future
export const AssistantAnswerSchema = z.object({
    summary: z.string(),
    explanation: z.string(),
    steps: z.array(z.string()).max(5),
    escalate: z.boolean(),
    sources: z.array(z.string()),
    fallback_used: z.boolean(),
});
//# sourceMappingURL=schemas.js.map