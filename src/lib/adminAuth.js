import crypto from 'node:crypto';

const ENV_USERNAME = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ENV_SECRET = process.env.ADMIN_STATUS_SECRET || '';
const DEV_FALLBACK_SECRET = 'dearmisu-dev-admin-secret';
const ADMIN_SECRET = ENV_SECRET || DEV_FALLBACK_SECRET;
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// In-memory rate limiter for login attempts (15 min window, max 7 failed attempts)
const loginAttempts = new Map();

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0].trim();
  return first || request.headers.get('x-real-ip') || 'local';
}

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
  if (!user || !pass) return false;

  const allowedUser = ENV_USERNAME || 'admin';
  const validUsers = new Set([allowedUser, 'admin'].filter(Boolean));
  if (!validUsers.has(user)) return false;

  const validPasswords = [ENV_PASSWORD, ENV_SECRET].filter(Boolean);
  if (validPasswords.length === 0 && process.env.NODE_ENV !== 'production') {
    validPasswords.push('admin123');
  }

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
  const payload = JSON.stringify({ u: username, role: 'administrator', ts: Date.now() });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(b64Payload).digest('base64url');
  return `${b64Payload}.${sig}`;
}

export function parseAdminToken(token) {
  if (!token) return null;

  // Accept raw secret for service-to-service admin calls when configured
  if (ENV_SECRET) {
    const rawBuf = Buffer.from(token);
    const secBuf = Buffer.from(ENV_SECRET);
    if (rawBuf.length === secBuf.length && crypto.timingSafeEqual(rawBuf, secBuf)) {
      return { authenticated: true, username: ENV_USERNAME || 'admin', role: 'administrator' };
    }
  }

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const b64Payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(b64Payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
    if (!data.ts || Date.now() - data.ts > SESSION_MAX_AGE_MS) return null;
    if (data.role && data.role !== 'administrator') return null;
    return {
      authenticated: true,
      username: String(data.u || 'admin'),
      role: data.role || 'administrator'
    };
  } catch {
    return null;
  }
}

export function verifyAdminToken(token) {
  return Boolean(parseAdminToken(token));
}

export function getAuthenticatedAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const secretHeader = request.headers.get('x-admin-status-secret') || '';
  const token = bearerToken || secretHeader;
  return parseAdminToken(token);
}

export function verifyAdminRequest(request) {
  return Boolean(getAuthenticatedAdmin(request));
}
