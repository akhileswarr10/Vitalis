/**
 * config.ts – parse ALL environment variables once, with Zod.
 * Import this module's loadConfig() result everywhere; never read process.env directly.
 * NEVER log the result – it contains secrets.
 */
import { z } from 'zod';

const ConfigSchema = z.object({
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),

  // ---- Supabase (Postgres) ----
  // Use "pglite://memory" in tests (CI) only.
  DATABASE_URL: z.string().min(1),

  // ---- Groq ----
  GROQ_API_KEY: z.string().default(''),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  LLM_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  LLM_FALLBACK_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
  LLM_REASONING_EFFORT: z.enum(['low', 'high', 'default']).default('low'),
  LLM_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().max(1000).default(800),
  // RESTRICTIONS.md §2: temperature ≤ 0.3
  LLM_TEMPERATURE: z.coerce.number().min(0).max(0.3).default(0.2),

  // ---- NASA DONKI ----
  NASA_API_KEY: z.string().default('DEMO_KEY'),
  SPACE_WEATHER_CACHE_MINUTES: z.coerce.number().int().positive().default(30),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate the environment. Called once in server.ts and once in each test
 * (tests pass a minimal object directly to avoid reading .env at all).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    // Surface validation errors without printing values (secrets may be present)
    throw new Error(
      `Configuration error:\n${result.error.issues
        .map(i => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return result.data;
}

