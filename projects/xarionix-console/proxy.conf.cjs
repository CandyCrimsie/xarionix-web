// One Web origin; Core and the opt-in verified ERP backend have separate contracts.
const target = process.env.XARIONIX_CONSOLE_CORE_TARGET || 'http://127.0.0.1:8000';
const erp = process.env.XARIONIX_WEB_ERP_TARGET || 'http://127.0.0.1:8001';
const tiles = process.env.XARIONIX_WEB_MAP_TARGET || 'http://127.0.0.1:8088';
module.exports = {
  '/map/tiles/**': { target: tiles, secure: true, changeOrigin: true, headers: { cookie: '', authorization: '' } },
  '/api/v1/**': { target: erp, secure: true, changeOrigin: true, headers: { cookie: '' } },
  '/core-api/**': {
    target,
    secure: true,
    changeOrigin: true,
    headers: { cookie: '' },
    pathRewrite: { '^/core-api': '' },
  },
};
