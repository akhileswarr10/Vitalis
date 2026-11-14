export const healthRoute = async (app, opts) => {
    const { db, config } = opts.deps;
    app.get('/health', async (_req, reply) => {
        // ---- Database probe ----
        let database_ok = false;
        try {
            await db.query('SELECT 1');
            database_ok = true;
        }
        catch {
            database_ok = false;
        }
        // ---- LLM availability probe ----
        let llm_available = false;
        if (config.GROQ_API_KEY) {
            try {
                const res = await fetch(`${config.GROQ_BASE_URL}/models`, {
                    headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` },
                    signal: AbortSignal.timeout(5_000),
                });
                if (res.ok) {
                    const data = (await res.json());
                    llm_available = data.data.some(m => m.id === config.LLM_MODEL);
                }
            }
            catch {
                llm_available = false;
            }
        }
        return reply.send({ status: 'ok', database_ok, llm_available });
    });
};
//# sourceMappingURL=health.js.map