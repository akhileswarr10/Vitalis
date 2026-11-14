import type { IncomingMessage, ServerResponse } from 'node:http';

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      let appModule: any;
      let dbModule: any;
      let configModule: any;
      try {
        appModule = await import('../backend/dist/app.js');
        dbModule = await import('../backend/dist/db.js');
        configModule = await import('../backend/dist/config.js');
      } catch {
        appModule = await import('../backend/src/app.js');
        dbModule = await import('../backend/src/db.js');
        configModule = await import('../backend/src/config.js');
      }

      const config = configModule.loadConfig(process.env);
      const db = await dbModule.createDb(config.DATABASE_URL);
      const app = await appModule.buildApp({ config, db });
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Ensure the request URL maintains the /api prefix that Fastify routes expect
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  const app = await getApp();
  app.server.emit('request', req, res);
}
