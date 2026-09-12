const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Inside Docker network, backend service is at http://backend:8000
  // On host machine, backend is at http://localhost:8081
  const target = process.env.BACKEND_PROXY_URL ||
    (process.env.CHOKIDAR_USEPOLLING === 'true' ? 'http://backend:8000' : 'http://localhost:8081');

  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'warn',
    })
  );

  app.use(
    '/uploads',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'warn',
    })
  );
};
