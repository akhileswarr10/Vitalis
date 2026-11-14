import { z } from 'zod';
import type { Config } from '../config.js';
import type { Db } from '../db.js';
import type { AssistantAnswer } from '../schemas.js';
export declare function getLlmAvailable(): boolean;
export declare function setLlmAvailable(val: boolean): void;
export declare function checkModelAvailability(config: Config): Promise<boolean>;
export interface AskOptions {
    config: Config;
    db: Db;
    astronautId: string;
    question: string;
}
export declare function ask(opts: AskOptions): Promise<AssistantAnswer>;
export declare const AskRequestSchema: z.ZodObject<{
    question: z.ZodString;
}, "strip", z.ZodTypeAny, {
    question: string;
}, {
    question: string;
}>;
//# sourceMappingURL=service.d.ts.map