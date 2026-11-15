// Vercel Fastify entrypoint
// Node.js executes this in CommonJS mode (/var/task/app.js)
let handlerPromise = null;

async function handler(req, res) {
  if (!handlerPromise) {
    handlerPromise = import('./app.mjs').then((m) => m.default);
  }
  const handle = await handlerPromise;
  return handle(req, res);
}

module.exports = handler;
module.exports.default = handler;
