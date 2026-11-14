# Vitalis: Autonomous Crew Health Monitor

Health monitoring for long-duration space missions. Astronauts log daily indicators; a **deterministic rules engine** (personal baselines + drift detection) decides status; a **Groq-hosted LLM** explains the status and guides next steps using only an onboard medical knowledge base. Data is stored in **Supabase (Postgres)**.

> Decision-support prototype built for the NASA Space Apps Challenge. Not a medical device. All data is synthetic.

## Architecture
```
React PWA (Vite, TS) ──► Node/Fastify ──► Supabase Postgres (RLS on, backend-only access)
                           ├─► Rules engine (source of truth for status)
                           ├─► Anomaly detector (rolling z-score, advisory)
                           ├─► RAG retriever (TF-IDF over src/knowledge/*.md)
                           ├─► LLM service ──► Groq API (OpenAI-compatible)
                           └─► NASA DONKI space weather (cached, optional)
```
Key rule: **The deterministic rules engine alone decides status; the LLM only explains.**

## Supabase setup
1. **Create project:** Sign in to [Supabase](https://supabase.com) and create a new project.
2. **Run schema migration:** In the Supabase project dashboard, open the **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and click **Run**. This creates tables `astronauts`, `check_ins`, and `assistant_logs` with check constraints and Row Level Security (RLS) enabled.
3. **Copy connection string:** Go to **Project Settings** → **Database** (or click **Connect** in Dashboard), select the **Session pooler** or **Transaction pooler** connection string (works over IPv4), and set it as `DATABASE_URL` in `.env` using the `postgresql://` scheme with TLS enabled.
4. **Wake paused projects:** Note that free-tier Supabase projects automatically pause after a period of inactivity. Always check the Supabase dashboard and wake the project before demonstrations.

## Setup
1. **Supabase:** Follow the "Supabase setup" steps above to configure `DATABASE_URL`.
2. **Groq:** create a free API key at console.groq.com, set `GROQ_API_KEY`. Check the current model list (`GET https://api.groq.com/openai/v1/models`) and set `LLM_MODEL` to a model that exists today.
3. **Run:**
```bash
cp .env.example .env   # then fill in the values above
docker compose up --build
# frontend http://localhost:5173   backend http://localhost:8000/api/health
```
Without Docker: `cd backend && npm i && npm run dev` (Node 20+) and `cd frontend && npm i && npm run dev`.
Tests and CI use an in-process Postgres (PGlite) and mocked Groq, so they need no accounts.

## License
MIT. See `LICENSE`.
