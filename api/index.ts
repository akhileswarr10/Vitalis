/**
 * Vercel Serverless Function — catch-all handler for all /api/* routes.
 *
 * Imports from pre-compiled backend/dist/ (committed to git, ESM modules).
 * @vercel/node bundles this file and its imports; dist/ is included via
 * includeFiles in vercel.json.
 *
 * Uses Fastify app.inject() — the full plugin/route lifecycle runs without
 * needing an HTTP socket.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';

// Suppress TS path errors — these are plain JS files at runtime
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { loadConfig } from '../backend/dist/config.js';
// @ts-ignore
import { createDb } from '../backend/dist/db.js';
// @ts-ignore
import { buildApp } from '../backend/dist/app.js';

// Cache across warm invocations
let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const config = loadConfig();
      const db = createDb(config);
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
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    const payload = await readBody(req);

    const response = await app.inject({
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      url: req.url ?? '/',
      headers: req.headers as Record<string, string>,
      payload,
    });

    res.statusCode = response.statusCode;
    for (const [key, val] of Object.entries(response.headers)) {
      if (val !== undefined) res.setHeader(key, val as string | string[]);
    }
    res.end(response.rawPayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[vitalis-api] handler error:', message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message }));
    }
  }
}
