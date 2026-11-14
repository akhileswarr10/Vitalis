/**
 * llm/service.ts – Groq LLM service with guardrails.
 *
 * CLAUDE.md rule 3 requirements:
 * - Groq chat completions via built-in fetch (NO vendor SDK).
 * - Uses system.md verbatim as the system message.
 * - JSON output validated with Zod AssistantAnswer schema.
 * - Timeout via AbortSignal.timeout().
 * - HTTP 429: honor Retry-After once (≤5 s), then try LLM_FALLBACK_MODEL.
 * - Invalid JSON output: retry once, then deterministic fallback.
 * - Any failure → deterministic fallback from engine/actions.ts (fallback_used: true).
 * - escalate is ALWAYS forced to true when overall_level == 2.
 * - Request body sent to Groq contains NO astronaut id, name, or timestamp.
 * - Never log the API key or full prompts at INFO level.
 *
 * RESTRICTIONS.md §2: temperature ≤ 0.3, max_completion_tokens ≤ 1000, timeout ≤ 30s.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Config } from '../config.js';
import type { Db } from '../db.js';
import { checkInsRepo } from '../repo/checkIns.js';
import { assistantLogsRepo } from '../repo/assistantLogs.js';
import { assess } from '../engine/evaluate.js';
import { getDeterministicGuidance, getActions } from '../engine/actions.js';
import { retrieve } from './retriever.js';
import type { AssessResult } from '../engine/evaluate.js';
import type { AssistantAnswer } from '../schemas.js';
import { AssistantAnswerSchema } from '../schemas.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// ---- Load system prompt once at module init --------------------------------
const SYSTEM_PROMPT = readFileSync(join(__dir, 'prompts/system.md'), 'utf8');

// ---- LLM availability state (module-level, shared) -------------------------
let _llmAvailable: boolean | null = null; // null = not checked yet

export function getLlmAvailable(): boolean {
  return _llmAvailable === true;
}

export function setLlmAvailable(val: boolean): void {
  _llmAvailable = val;
}

// ---- Model validation at startup -------------------------------------------

export async function checkModelAvailability(config: Config): Promise<boolean> {
  if (!config.GROQ_API_KEY) {
    setLlmAvailable(false);
    return false;
  }
  try {
    const res = await fetch(`${config.GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      setLlmAvailable(false);
      return false;
    }
    const data = (await res.json()) as { data: Array<{ id: string }> };
    const available = data.data.some(m => m.id === config.LLM_MODEL);
    setLlmAvailable(available);
    return available;
  } catch {
    setLlmAvailable(false);
    return false;
  }
}

// ---- Groq request shape ---------------------------------------------------

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

interface GroqRequestBody {
  model: string;
  messages: GroqMessage[];
  temperature: number;
  max_completion_tokens: number;
  response_format: { type: 'json_object' };
  // reasoning_effort only sent when supported (non-reasoning models don't support it)
  reasoning_effort?: string;
}

// ---- Core Groq call --------------------------------------------------------

type GroqCallResult =
  | { ok: true; answer: AssistantAnswer; model: string }
  | { ok: false; reason: 'timeout' | 'rate_limit' | 'invalid_json' | 'api_error' | 'no_key'; retryAfterMs?: number };

async function callGroq(
  config: Config,
  messages: GroqMessage[],
  model: string,
  allowedSources: Set<string>,
): Promise<GroqCallResult> {
  if (!config.GROQ_API_KEY) return { ok: false, reason: 'no_key' };

  const body: GroqRequestBody = {
    model,
    messages,
    temperature: config.LLM_TEMPERATURE,
    max_completion_tokens: config.LLM_MAX_TOKENS,
    response_format: { type: 'json_object' },
  };

  // reasoning_effort is only valid for some Groq reasoning models.
  // We include it; Groq will ignore it for non-reasoning models.
  // Drop it if it causes issues by watching for 400 errors.
  body.reasoning_effort = config.LLM_REASONING_EFFORT;

  let res: Response;
  try {
    res = await fetch(`${config.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.LLM_TIMEOUT_SECONDS * 1_000),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { ok: false, reason: isTimeout ? 'timeout' : 'api_error' };
  }

  if (res.status === 429) {
    const retryAfterRaw = res.headers.get('retry-after');
    const retryAfterMs = retryAfterRaw ? Math.min(parseFloat(retryAfterRaw) * 1000, 5_000) : 0;
    return { ok: false, reason: 'rate_limit', retryAfterMs };
  }

  if (res.status === 400) {
    // 400 may mean reasoning_effort is not supported by this model — retry without it
    const retryBody = { ...body };
    delete retryBody.reasoning_effort;
    let res2: Response;
    try {
      res2 = await fetch(`${config.GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryBody),
        signal: AbortSignal.timeout(config.LLM_TIMEOUT_SECONDS * 1_000),
      });
    } catch {
      return { ok: false, reason: 'api_error' };
    }
    if (!res2.ok) return { ok: false, reason: 'api_error' };
    res = res2;
  } else if (!res.ok) {
    return { ok: false, reason: 'api_error' };
  }

  // Parse the JSON response
  let rawJson: unknown;
  try {
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    rawJson = JSON.parse(content);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  // Validate with Zod
  const parsed = AssistantAnswerSchema.safeParse(rawJson);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_json' };
  }

  const answer = { ...parsed.data };

  // Drop sources not in the retrieved set (RESTRICTIONS.md §2 grounding)
  answer.sources = answer.sources.filter(s => allowedSources.has(s));

  // Always set fallback_used: false for real LLM responses
  answer.fallback_used = false;

  return { ok: true, answer, model };
}

// ---- Build user message payload (no astronaut id, name, or timestamp) ------

function buildUserMessage(
  status: AssessResult,
  latestReadings: Record<string, number>,
  guides: Array<{ source: string; text: string }>,
  question: string,
): string {
  // RESTRICTIONS.md §2: only metric values and status levels go to Groq – no IDs or timestamps
  return JSON.stringify({
    status: {
      overall: status.overall,
      multi_domain: status.multi_domain,
      domains: status.domains.map(d => ({ domain: d.domain, level: d.level })),
    },
    readings: latestReadings,
    guides,
    question,
  });
}

// ---- Main ask function -------------------------------------------------------

export interface AskOptions {
  config: Config;
  db: Db;
  astronautId: string;
  question: string;
}

export async function ask(opts: AskOptions): Promise<AssistantAnswer> {
  const { config, db, astronautId } = opts;
  // RESTRICTIONS.md §2: truncate question to 500 chars
  const question = opts.question.slice(0, 500);

  // 1. Load check-ins and assess status
  const checkIns = await checkInsRepo.findByAstronautId(db, astronautId);
  const entries = checkIns.map(ci => ({
    day: ci.day, hr: ci.hr, sbp: ci.sbp, ortho: ci.ortho, ex: ci.ex,
    bone: ci.bone, temp: ci.temp, sym: ci.sym, sleep: ci.sleep,
    mood: ci.mood, stress: ci.stress, dose: ci.dose, co2: ci.co2,
  }));
  const status = assess(entries);

  // 2. Build deterministic fallback first so it's always available
  const deterministicFallback: AssistantAnswer = getDeterministicGuidance(status);
  // If level 2 and no emergency step in fallback, prepend one
  if (status.overall === 2) {
    deterministicFallback.escalate = true;
  }

  // 3. If no API key or LLM marked unavailable → deterministic immediately
  if (!config.GROQ_API_KEY || _llmAvailable === false) {
    await _logAndReturn(db, astronautId, question, deterministicFallback, null);
    return deterministicFallback;
  }

  // 4. Retrieve passages
  const retrieved = retrieve(question, status, 4);
  const guides = retrieved.map(p => ({ source: p.filename, text: p.text }));
  const allowedSources = new Set(retrieved.map(p => p.filename));

  // 5. Build the latest readings snapshot (no timestamps, no IDs)
  const latestCheckIn = checkIns.at(-1);
  const latestReadings: Record<string, number> = latestCheckIn
    ? {
        hr: latestCheckIn.hr, sbp: latestCheckIn.sbp, ortho: latestCheckIn.ortho,
        ex: latestCheckIn.ex, bone: latestCheckIn.bone, temp: latestCheckIn.temp,
        sym: latestCheckIn.sym, sleep: latestCheckIn.sleep, mood: latestCheckIn.mood,
        stress: latestCheckIn.stress, dose: latestCheckIn.dose, co2: latestCheckIn.co2,
      }
    : {};

  // 6. Build messages
  const messages: GroqMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(status, latestReadings, guides, question) },
  ];

  // 7. Call Groq (primary model, with one retry on invalid JSON)
  let result = await callGroq(config, messages, config.LLM_MODEL, allowedSources);

  // 7a. Invalid JSON → retry once
  if (!result.ok && result.reason === 'invalid_json') {
    result = await callGroq(config, messages, config.LLM_MODEL, allowedSources);
  }

  // 7b. 429 → honor Retry-After (up to 5 s), then try fallback model
  if (!result.ok && result.reason === 'rate_limit') {
    const delay = result.retryAfterMs ?? 0;
    if (delay > 0) await sleep(delay);
    result = await callGroq(config, messages, config.LLM_FALLBACK_MODEL, allowedSources);
  }

  // 7c. Still failing for any reason → deterministic fallback
  if (!result.ok) {
    await _logAndReturn(db, astronautId, question, deterministicFallback, null);
    return deterministicFallback;
  }

  // 8. Post-process: enforce escalation and emergency step rules
  const answer = enforceEscalation(result.answer, status);

  // 9. Log to assistant_logs
  await _logAndReturn(db, astronautId, question, answer, result.model);
  return answer;
}

// ---- Enforce escalate and emergency step rules (RESTRICTIONS.md §1) ---------

function enforceEscalation(answer: AssistantAnswer, status: AssessResult): AssistantAnswer {
  const result = { ...answer, steps: [...answer.steps] };

  // Always force escalate strictly equal to (overall_level == 2)
  result.escalate = status.overall === 2;

  if (status.overall === 2) {
    // Ensure the first step is the deterministic emergency step for the worst domain
    const worstDomain = status.domains
      .filter(d => d.level === 2)
      .sort((a, b) => a.domain.localeCompare(b.domain))[0];

    if (worstDomain) {
      const emergencySteps = getActions(worstDomain.domain, 2);
      const emergencyStep = emergencySteps[0];
      if (emergencyStep && !result.steps[0]?.toUpperCase().includes('CONTACT GROUND')) {
        result.steps = [emergencyStep, ...result.steps.slice(0, 4)];
      }
    }
  } else {
    // Level 0 or 1: escalate must NOT be forced to true by LLM.
    // But we do not force it to false either (the LLM may have set it correctly).
    // The key restriction is: level 2 → ALWAYS escalate. Otherwise respect LLM.
  }

  return result;
}

// ---- Helper: log then return ------------------------------------------------

async function _logAndReturn(
  db: Db,
  astronautId: string,
  question: string,
  answer: AssistantAnswer,
  model: string | null,
): Promise<void> {
  try {
    await assistantLogsRepo.create(db, {
      astronaut_id: astronautId,
      question,
      answer,
      model,
      fallback_used: answer.fallback_used,
    });
  } catch {
    // Log failure is non-fatal – don't block the response
  }
}

// ---- Utility ----------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Zod schema for the assistant request ----------------------------------

export const AskRequestSchema = z.object({
  question: z.string().min(1).max(2000),
});

