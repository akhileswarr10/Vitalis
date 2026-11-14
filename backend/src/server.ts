/**
 * server.ts – production entry point.
 * Loads config, creates DB connection, builds app, starts listening.
 * Tests must NOT import this file; they import app.ts directly.
 */
import dotenv from 'dotenv';
import path from 'node:path';

// Load .env from cwd; if DATABASE_URL is not set, fallback to parent directory
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { buildApp } from './app.js';

const config = loadConfig();
const db = await createDb(config.DATABASE_URL);
const app = await buildApp({ config, db });

// ---- Graceful shutdown ----
// RESTRICTIONS.md §4 / Prompt 11: clean up pg Pool on SIGTERM (Docker stop)
const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'Graceful shutdown started');
  try {
    await app.close();
    await db.close();
    app.log.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Catch unhandled rejections & uncaught exceptions – CLAUDE.md: no unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  app.log.error({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  app.log.error(err, 'Uncaught exception');
  process.exit(1);
});

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err, 'Failed to start server');
  await db.close();
  process.exit(1);
}

