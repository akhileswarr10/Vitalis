let handlerPromise = null;

module.exports = async function handler(req, res) {
  if (!handlerPromise) {
    handlerPromise = import('./app.mjs').then((m) => m.default);
  }
  const handle = await handlerPromise;
  return handle(req, res);
};
