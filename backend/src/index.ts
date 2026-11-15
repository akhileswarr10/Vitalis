import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { buildApp } from './app.js';

let appPromise: ReturnType<typeof buildApp> | null = null;

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

async function readBody(req: IncomingMessage): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if ('body' in req && (req as { body?: unknown }).body !== undefined) {
    const b = (req as { body: unknown }).body;
    return typeof b === 'string' ? b : JSON.stringify(b);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
}

// Handler function for direct serverless invocation
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    const payload = await readBody(req);

    const response = await app.inject({
      method: (req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS') ?? 'GET',
      url: req.url || '/',
      headers: req.headers as Record<string, string>,
      payload,
    });

    res.statusCode = response.statusCode;
    for (const [key, val] of Object.entries(response.headers)) {
      if (val !== undefined) {
        res.setHeader(key, val);
      }
    }
    res.end(response.rawPayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Fastify Vercel Handler Error:', message, stack);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          statusCode: 500,
          error: 'Internal Server Error',
          message,
        }),
      );
    }
  }
}
