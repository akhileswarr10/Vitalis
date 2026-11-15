import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const __dir = dirname(fileURLToPath(import.meta.url));

console.log('Bundling Fastify app to app.mjs...');
esbuild.buildSync({
  entryPoints: [join(__dir, 'src/app.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: join(__dir, 'app.mjs'),
  external: ['@electric-sql/pglite', 'pg-native'],
});
console.log('Bundled app.mjs successfully!');
