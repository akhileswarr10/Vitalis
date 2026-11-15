/**
 * app.ts – build the Fastify application without starting to listen.
 * Tests call buildApp() and use fastify.inject(); server.ts calls it then listens.
 *
 * Dependency-injection pattern: all external resources (db, config) are passed
 * in as deps so tests can substitute PGlite and mocked config freely.
 */
import { type FastifyInstance } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type Config } from './config.js';
import { type Db } from './db.js';
export interface AppDeps {
    config: Config;
    db: Db;
}
export declare function buildApp(deps: AppDeps): Promise<FastifyInstance>;
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
//# sourceMappingURL=app.d.ts.map