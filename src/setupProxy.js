const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Explicit proxy so /api, /transcript, and /audio-download hit the transcript server.
 * (package.json "proxy" alone can miss some POST routes depending on dev-server behavior.)
 */
module.exports = function setupProxy(app) {
  const target =
    process.env.REACT_APP_TRANSCRIPT_API_URL || 'http://localhost:3222';

  app.use(
    ['/api', '/transcript', '/audio-download'],
    createProxyMiddleware({
      target,
      changeOrigin: true
    })
  );
};
