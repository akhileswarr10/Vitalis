/**
 * actions.ts – Deterministic guidance text per domain × level.
 * No I/O, no randomness. Used by the LLM service as the final fallback
 * (CLAUDE.md rule 1 & 3: level-2 emergency steps always shown regardless of LLM).
 *
 * RESTRICTIONS.md §1: Level 2 ALWAYS shows emergency steps, regardless of LLM output.
 */
import type { Domain } from './thresholds.js';
import type { Level } from './evaluate.js';
import type { AssessResult } from './evaluate.js';
export declare function getActions(domain: Domain, level: Level): string[];
/**
 * getDeterministicGuidance — builds a full AssistantAnswer-shaped response from
 * the rules engine result alone.  Used when the LLM is unavailable or its output
 * is invalid (CLAUDE.md rule 3: final deterministic fallback).
 */
export declare function getDeterministicGuidance(result: AssessResult): {
    summary: string;
    explanation: string;
    steps: string[];
    escalate: boolean;
    sources: string[];
    fallback_used: true;
};
//# sourceMappingURL=actions.d.ts.map