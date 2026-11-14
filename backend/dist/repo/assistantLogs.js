export const assistantLogsRepo = {
    /** Log an assistant Q&A turn. */
    async create(db, log) {
        const sql = `
      INSERT INTO public.assistant_logs (
        astronaut_id, question, answer, model, fallback_used
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const answerJson = typeof log.answer === 'string' ? log.answer : JSON.stringify(log.answer);
        const params = [
            log.astronaut_id,
            log.question,
            answerJson,
            log.model ?? null,
            log.fallback_used,
        ];
        const result = await db.query(sql, params);
        const row = result.rows[0];
        if (!row) {
            throw new Error(`Failed to create assistant log for astronaut ${log.astronaut_id}`);
        }
        return {
            id: Number(row.id),
            astronaut_id: String(row.astronaut_id),
            question: String(row.question),
            answer: typeof row.answer === 'string' ? JSON.parse(row.answer) : row.answer,
            model: row.model ? String(row.model) : null,
            fallback_used: Boolean(row.fallback_used),
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        };
    },
    /** Retrieve recent assistant logs for an astronaut. */
    async findByAstronautId(db, astronautId, limit = 50) {
        const sql = `
      SELECT *
      FROM public.assistant_logs
      WHERE astronaut_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
        const result = await db.query(sql, [astronautId, limit]);
        return result.rows.map(row => ({
            id: Number(row.id),
            astronaut_id: String(row.astronaut_id),
            question: String(row.question),
            answer: typeof row.answer === 'string' ? JSON.parse(row.answer) : row.answer,
            model: row.model ? String(row.model) : null,
            fallback_used: Boolean(row.fallback_used),
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        }));
    },
};
//# sourceMappingURL=assistantLogs.js.map