import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { buildApp } from './app.js';
let appPromise = null;
async function getApp() {
    if (!appPromise) {
        appPromise = (async () => {
            const config = loadConfig(process.env);
            const db = await createDb(config.DATABASE_URL);
            const app = await buildApp({ config, db });
            await app.ready();
            return app;
        })().catch((err) => {
            appPromise = null;
            throw err;
        });
    }
    return appPromise;
}
async function readBody(req) {
    if (req.method === 'GET' || req.method === 'HEAD')
        return undefined;
    if ('body' in req && req.body !== undefined) {
        const b = req.body;
        return typeof b === 'string' ? b : JSON.stringify(b);
    }
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
}
// Handler function for direct serverless invocation
export default async function handler(req, res) {
    try {
        const app = await getApp();
        const payload = await readBody(req);
        const response = await app.inject({
            method: req.method ?? 'GET',
            url: req.url || '/',
            headers: req.headers,
            payload,
        });
        res.statusCode = response.statusCode;
        for (const [key, val] of Object.entries(response.headers)) {
            if (val !== undefined) {
                res.setHeader(key, val);
            }
        }
        res.end(response.rawPayload);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        console.error('Fastify Vercel Handler Error:', message, stack);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                statusCode: 500,
                error: 'Internal Server Error',
                message,
            }));
        }
    }
}
//# sourceMappingURL=index.js.map