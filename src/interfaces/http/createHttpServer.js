'use strict';

const http = require('node:http');
const { AppError } = require('../../application/appError');
const { sendJson } = require('./response');
const { createApiController } = require('./apiController');
const { createStaticController } = require('./staticController');

// ประกอบ HTTP adapter ให้ domain/application ไม่ต้องพึ่ง Node HTTP โดยตรง
function createHttpServer({ services, publicDirectory, expectedOrigin, secureCookie, healthCheck }) {
  const handleApi = createApiController({
    authService: services.auth,
    ledgerService: services.ledger,
    expectedOrigin,
    secureCookie,
    healthCheck
  });
  const serveStatic = createStaticController(publicDirectory);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else if (req.method === 'GET') serveStatic(req, res, url.pathname);
      else sendJson(res, 405, { error: 'ไม่รองรับคำขอนี้' });
    } catch (error) {
      console.error('Request failed:', error.message);
      if (!res.headersSent) sendJson(res, error instanceof AppError ? error.status : (error.status || 500), {
        error: error instanceof AppError || error.status ? error.message : 'เกิดข้อผิดพลาดในระบบ'
      });
      else res.destroy();
    }
  });
}

module.exports = { createHttpServer };
