/**
 * api/client.ts – THE ONLY place in the frontend that calls the backend.
 *
 * CLAUDE.md rule 6: "The frontend only calls our backend. It never calls
 * Groq or Supabase directly and holds no Supabase keys."
 */
import type {
  HealthResponse,
  CheckIn,
  CheckInCreate,
  SeedResponse,
  StatusResponse,
  TrendsResponse,
  AssistantAnswer,
  SpaceWeatherResponse,
} from '../types.js';

export * from '../types.js';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

/** Generic fetch wrapper – surfaces HTTP errors as thrown Errors. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/** Plain-text fetch wrapper for reports and text streams. */
async function apiFetchText(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }

  return res.text();
}

export const api = {
  getHealth(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>('/api/health');
  },

  addCheckIn(astronautId: string, data: CheckInCreate): Promise<CheckIn> {
    return apiFetch<CheckIn>(`/api/astronauts/${encodeURIComponent(astronautId)}/checkins`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCheckIns(astronautId: string): Promise<CheckIn[]> {
    return apiFetch<CheckIn[]>(`/api/astronauts/${encodeURIComponent(astronautId)}/checkins`);
  },

  getStatus(astronautId: string): Promise<StatusResponse> {
    return apiFetch<StatusResponse>(`/api/astronauts/${encodeURIComponent(astronautId)}/status`);
  },

  getTrends(astronautId: string, metric: string): Promise<TrendsResponse> {
    return apiFetch<TrendsResponse>(`/api/astronauts/${encodeURIComponent(astronautId)}/trends/${encodeURIComponent(metric)}`);
  },

  askAssistant(astronautId: string, question: string): Promise<AssistantAnswer> {
    return apiFetch<AssistantAnswer>(`/api/astronauts/${encodeURIComponent(astronautId)}/assistant`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },

  seedDemo(): Promise<SeedResponse> {
    return apiFetch<SeedResponse>('/api/demo/seed', {
      method: 'POST',
    });
  },

  getReport(astronautId: string): Promise<string> {
    return apiFetchText(`/api/astronauts/${encodeURIComponent(astronautId)}/report`);
  },

  getSpaceWeather(): Promise<SpaceWeatherResponse> {
    return apiFetch<SpaceWeatherResponse>('/api/space-weather');
  },
};
