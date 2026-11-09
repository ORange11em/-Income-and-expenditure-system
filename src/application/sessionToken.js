'use strict';

const crypto = require('node:crypto');

// บันทึก hash ของ session ID เพื่อไม่เก็บ token ที่ส่งให้เบราว์เซอร์ไว้ในฐานข้อมูล
function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hashSessionToken };
