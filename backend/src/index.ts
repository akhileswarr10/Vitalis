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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
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
