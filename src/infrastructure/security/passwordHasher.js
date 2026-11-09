'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

// Adapter สำหรับ hash/ตรวจรหัสผ่าน ให้ application layer เรียกผ่าน interface นี้
class ScryptPasswordHasher {
  async hash(password) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return `scrypt$32768$8$1$${salt.toString('hex')}$${Buffer.from(key).toString('hex')}`;
  }

  async verify(password, encoded) {
    try {
      const [scheme, n, r, p, saltHex, keyHex] = encoded.split('$');
      if (scheme !== 'scrypt') return false;
      const expected = Buffer.from(keyHex, 'hex');
      const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, {
        N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
      }));
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}

module.exports = { ScryptPasswordHasher };
