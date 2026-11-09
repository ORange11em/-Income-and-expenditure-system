'use strict';

// แยก cookie และสร้าง cookie ที่ตั้งค่า HttpOnly/SameSite/Secure ตามสภาพแวดล้อม
function cookieValue(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function setSessionCookie(res, id, secure, maxAge = 8 * 86400) {
  const secureAttribute = secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `it_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureAttribute}`);
}

function clearSessionCookie(res, secure) {
  const secureAttribute = secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `it_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute}`);
}

// ป้องกัน request ปลอมจาก origin อื่นก่อนแก้ข้อมูล
function isAllowedOrigin(req, expectedOrigin) {
  if (!expectedOrigin || req.headers.origin !== expectedOrigin) return false;
  const fetchSite = req.headers['sec-fetch-site'];
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

// อ่าน JSON body โดยจำกัดขนาดไว้ 1 MiB
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error('request too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid JSON'), { status: 400 });
  }
}

module.exports = { cookieValue, setSessionCookie, clearSessionCookie, isAllowedOrigin, readJson };
