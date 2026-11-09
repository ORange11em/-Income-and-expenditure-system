'use strict';

const { sendJson } = require('./response');
const { cookieValue, setSessionCookie, clearSessionCookie, isAllowedOrigin, readJson } = require('./request');

// Controller แปลง HTTP request เป็นคำสั่งของ application services แล้วแปลงผลกลับเป็น response
function createApiController({ authService, ledgerService, expectedOrigin, secureCookie, healthCheck }) {
  return async function handleApi(req, res, url) {
    const pathname = url.pathname;
    if (req.method === 'GET' && pathname === '/api/health') {
      await healthCheck();
      return sendJson(res, 200, { status: 'ok' });
    }

    const sessionId = cookieValue(req, 'it_session');
    let session = await authService.getSession(sessionId);
    if (req.method === 'GET' && pathname === '/api/session') {
      if (!session) {
        const anonymous = await authService.createAnonymousSession();
        setSessionCookie(res, anonymous.id, secureCookie);
        session = { csrf: anonymous.csrf, user: null };
      }
      return sendJson(res, 200, { user: session.user, csrfToken: session.csrf });
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (!isAllowedOrigin(req, expectedOrigin)) return sendJson(res, 403, { error: 'คำขอมาจากแหล่งที่ไม่อนุญาต' });
      if (!session || req.headers['x-csrf-token'] !== session.csrf) {
        return sendJson(res, 403, { error: 'CSRF token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่' });
      }
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await readJson(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const result = await authService.login({
        currentSessionId: session?.id,
        username,
        password,
        ip: req.socket.remoteAddress || 'unknown'
      });
      setSessionCookie(res, result.session.id, secureCookie);
      return sendJson(res, 200, { user: result.user, csrfToken: result.session.csrf });
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
      await authService.logout(session?.id);
      clearSessionCookie(res, secureCookie);
      return sendJson(res, 200, { ok: true });
    }

    if (!session?.user) return sendJson(res, 401, { error: 'กรุณาเข้าสู่ระบบ' });

    if (req.method === 'GET' && pathname === '/api/transactions') {
      return sendJson(res, 200, await ledgerService.list());
    }

    if (req.method === 'POST' && pathname === '/api/transactions') {
      const item = await ledgerService.create(session.user, await readJson(req));
      return sendJson(res, 201, { item });
    }

    const voidMatch = pathname.match(/^\/api\/transactions\/(\d+)\/void$/);
    if (req.method === 'POST' && voidMatch) {
      const body = await readJson(req);
      return sendJson(res, 200, await ledgerService.void(session.user, voidMatch[1], body.reason));
    }

    if (req.method === 'GET' && pathname === '/api/audit') {
      return sendJson(res, 200, { items: await ledgerService.audit(session.user) });
    }

    return sendJson(res, 404, { error: 'ไม่พบ API' });
  };
}

module.exports = { createApiController };
