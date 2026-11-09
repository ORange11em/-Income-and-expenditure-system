'use strict';

const crypto = require('node:crypto');
const { AppError } = require('./appError');
const { hashSessionToken } = require('./sessionToken');

// กฎเข้าสู่ระบบและอายุ session โดยไม่ผูกกับ HTTP request/response
function createAuthService({ userRepository, sessionRepository, passwordHasher, loginFailures, sessionDays = 8 }) {
  async function createSession(userId = null) {
    const id = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(32).toString('base64url');
    await sessionRepository.create(hashSessionToken(id), csrf, userId, sessionDays);
    return { id, csrf };
  }

  return {
    async getSession(id) {
      if (!id || id.length > 128) return null;
      const row = await sessionRepository.findByIdHash(hashSessionToken(id));
      if (!row || (row.user_id && !row.active)) return null;
      return {
        id,
        csrf: row.csrf_token,
        user: row.user_id ? { id: row.user_id, username: row.username, role: row.role } : null
      };
    },

    createAnonymousSession() {
      return createSession();
    },

    async login({ currentSessionId, username, password, ip }) {
      const attemptKey = `${ip || 'unknown'}:${String(username).toLocaleLowerCase('en-US')}`;
      const throttle = loginFailures.get(attemptKey);
      if (throttle && throttle.blockedUntil > Date.now()) {
        throw new AppError(429, 'เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอสักครู่แล้วลองใหม่');
      }

      const user = await userRepository.findByUsername(username);
      const accepted = Boolean(user?.active && await passwordHasher.verify(password, user.password_hash));
      if (!accepted) {
        const state = throttle && throttle.windowUntil > Date.now()
          ? throttle
          : { count: 0, windowUntil: Date.now() + 15 * 60 * 1000, blockedUntil: 0 };
        state.count += 1;
        if (state.count >= 5) state.blockedUntil = Date.now() + 15 * 60 * 1000;
        loginFailures.set(attemptKey, state);
        throw new AppError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }

      loginFailures.delete(attemptKey);
      if (currentSessionId) await sessionRepository.deleteByIdHash(hashSessionToken(currentSessionId));
      const session = await createSession(user.id);
      return { session, user: { id: user.id, username: user.username, role: user.role } };
    },

    async logout(sessionId) {
      if (sessionId) await sessionRepository.deleteByIdHash(hashSessionToken(sessionId));
    }
  };
}

module.exports = { createAuthService };
