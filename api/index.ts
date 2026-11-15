import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

let handlerPromise: Promise<Handler> | null = null;

// new Function prevents TypeScript from converting dynamic import() → require()
// require() cannot load ESM (.mjs) files; dynamic import() can.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  s: string
) => Promise<{ default: Handler }>;

async function getHandler(): Promise<Handler> {
  if (!handlerPromise) {
    handlerPromise = dynamicImport('../backend/app.mjs').then((m) => m.default);
  }
  return handlerPromise!;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const handle = await getHandler();
    return await handle(req, res);
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
