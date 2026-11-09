'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sendJson } = require('./response');

// เสิร์ฟเฉพาะไฟล์หน้าเว็บที่ระบุ ไม่เปิด public directory เป็น file listing
function createStaticController(publicDirectory) {
  const routes = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/akat-amnuai-logo.png': ['akat-amnuai-logo.png', 'image/png']
  };

  return function serveStatic(req, res, pathname) {
    const route = routes[pathname];
    if (!route) return sendJson(res, 404, { error: 'ไม่พบหน้า' });
    fs.readFile(path.join(publicDirectory, route[0]), (error, contents) => {
      if (error) return sendJson(res, 404, { error: 'ไม่พบไฟล์' });
      res.writeHead(200, {
        'Content-Type': route[1],
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
      });
      res.end(contents);
    });
  };
}

module.exports = { createStaticController };
