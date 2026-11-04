// This proxy belongs only to Console. The ERP /api proxy is unchanged.
const target = process.env.XARIONIX_CONSOLE_CORE_TARGET || 'http://127.0.0.1:8000';
module.exports = {
  '/core-api/**': {
    target,
    secure: true,
    changeOrigin: true,
    headers: { cookie: '' },
    pathRewrite: { '^/core-api': '' },
  },
};
