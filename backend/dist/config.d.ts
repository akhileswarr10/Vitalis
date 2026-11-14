/**
 * config.ts – parse ALL environment variables once, with Zod.
 * Import this module's loadConfig() result everywhere; never read process.env directly.
 * NEVER log the result – it contains secrets.
 */
import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    APP_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    CORS_ORIGINS: z.ZodDefault<z.ZodString>;
    RATE_LIMIT_PER_MINUTE: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodDefault<z.ZodString>;
    GROQ_API_KEY: z.ZodDefault<z.ZodString>;
    GROQ_BASE_URL: z.ZodDefault<z.ZodString>;
    LLM_MODEL: z.ZodDefault<z.ZodString>;
    LLM_FALLBACK_MODEL: z.ZodDefault<z.ZodString>;
    LLM_REASONING_EFFORT: z.ZodDefault<z.ZodEnum<["low", "high", "default"]>>;
    LLM_TIMEOUT_SECONDS: z.ZodDefault<z.ZodNumber>;
    LLM_MAX_TOKENS: z.ZodDefault<z.ZodNumber>;
    LLM_TEMPERATURE: z.ZodDefault<z.ZodNumber>;
    NASA_API_KEY: z.ZodDefault<z.ZodString>;
    SPACE_WEATHER_CACHE_MINUTES: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    APP_ENV: "development" | "production" | "test";
    PORT: number;
    CORS_ORIGINS: string;
    RATE_LIMIT_PER_MINUTE: number;
    DATABASE_URL: string;
    GROQ_API_KEY: string;
    GROQ_BASE_URL: string;
    LLM_MODEL: string;
    LLM_FALLBACK_MODEL: string;
    LLM_REASONING_EFFORT: "low" | "high" | "default";
    LLM_TIMEOUT_SECONDS: number;
    LLM_MAX_TOKENS: number;
    LLM_TEMPERATURE: number;
    NASA_API_KEY: string;
    SPACE_WEATHER_CACHE_MINUTES: number;
}, {
    APP_ENV?: "development" | "production" | "test" | undefined;
    PORT?: number | undefined;
    CORS_ORIGINS?: string | undefined;
    RATE_LIMIT_PER_MINUTE?: number | undefined;
    DATABASE_URL?: string | undefined;
    GROQ_API_KEY?: string | undefined;
    GROQ_BASE_URL?: string | undefined;
    LLM_MODEL?: string | undefined;
    LLM_FALLBACK_MODEL?: string | undefined;
    LLM_REASONING_EFFORT?: "low" | "high" | "default" | undefined;
    LLM_TIMEOUT_SECONDS?: number | undefined;
    LLM_MAX_TOKENS?: number | undefined;
    LLM_TEMPERATURE?: number | undefined;
    NASA_API_KEY?: string | undefined;
    SPACE_WEATHER_CACHE_MINUTES?: number | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
/**
 * Parse and validate the environment. Called once in server.ts and once in each test
 * (tests pass a minimal object directly to avoid reading .env at all).
 */
export declare function loadConfig(env?: NodeJS.ProcessEnv): Config;
export {};
//# sourceMappingURL=config.d.ts.map