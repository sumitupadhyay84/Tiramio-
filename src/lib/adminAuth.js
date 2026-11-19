import crypto from 'node:crypto';

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin@fitpulse.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_SECRET = process.env.ADMIN_STATUS_SECRET || 'SU84upadhyay!@';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// In-memory rate limiter for login attempts (15 min window, max 7 failed attempts)
const loginAttempts = new Map();

export function checkLoginRateLimit(ip = 'client') {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (now - record.firstAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  if (record.count >= 7) {
    const minutesLeft = Math.ceil((15 * 60 * 1000 - (now - record.firstAttempt)) / 60000);
    return { allowed: false, minutesLeft };
  }
  return { allowed: true };
}

export function recordFailedLogin(ip = 'client') {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || (now - record.firstAttempt > 15 * 60 * 1000)) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

export function resetLoginAttempts(ip = 'client') {
  loginAttempts.delete(ip);
}

export function validateAdminCredentials(username, password) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '').trim();

  // Allowed usernames: configured ADMIN_USERNAME, 'admin', or 'admin@fitpulse.com'
  const validUsers = new Set([ADMIN_USERNAME, 'admin', 'admin@fitpulse.com']);
  if (!validUsers.has(user)) return false;

  // Allowed passwords: configured ADMIN_PASSWORD, ADMIN_SECRET, or fallback values
  const validPasswords = [ADMIN_PASSWORD, ADMIN_SECRET, 'admin123', 'SU84upadhyay!@'].filter(Boolean);

  const passBuf = Buffer.from(pass);
  for (const expected of validPasswords) {
    const expBuf = Buffer.from(expected);
    if (passBuf.length === expBuf.length && crypto.timingSafeEqual(passBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

export function createAdminToken(username = 'admin') {
  const secret = ADMIN_SECRET;
  const payload = JSON.stringify({ u: username, ts: Date.now() });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
  return `${b64Payload}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token) return false;

  // Check if token matches raw secret directly
  const secret = ADMIN_SECRET;
  const rawBuf = Buffer.from(token);
  const secBuf = Buffer.from(secret);
  if (rawBuf.length === secBuf.length && crypto.timingSafeEqual(rawBuf, secBuf)) {
    return true;
  }

  // Check JWT-style token: <b64Payload>.<sig>
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return false;

  const b64Payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const data = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
    if (!data.ts || Date.now() - data.ts > SESSION_MAX_AGE_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function verifyAdminRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const secretHeader = request.headers.get('x-admin-status-secret') || '';
  const token = bearerToken || secretHeader;

  return verifyAdminToken(token);
}

