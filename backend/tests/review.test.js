const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { z } = require('zod');

// 1. Review Schema Validation
const reviewSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.string().email().optional().or(z.literal('')),
  productName: z.enum(['Dear Misu Mini (100g)', 'Dear Misu Classic (200g)', 'Dear Misu Share Box (300g)']),
  overallRating: z.coerce.number().int().min(1).max(5),
  tasteRating: z.coerce.number().int().min(1).max(5).optional(),
  creaminessRating: z.coerce.number().int().min(1).max(5).optional(),
  coffeeIntensityRating: z.coerce.number().int().min(1).max(5).optional(),
  sweetnessRating: z.coerce.number().int().min(1).max(5).optional(),
  textureRating: z.coerce.number().int().min(1).max(5).optional(),
  chocolateRating: z.coerce.number().int().min(1).max(5).optional(),
  presentationRating: z.coerce.number().int().min(1).max(5).optional(),
  sweetnessPreference: z.enum(['Too sweet', 'Just right', 'Less sweet']).optional(),
  coffeePreference: z.enum(['Mild', 'Balanced', 'Strong']).optional(),
  texturePreference: z.enum(['Extra creamy', 'Soft and fluffy', 'Rich and layered', 'Perfectly balanced']).optional(),
  feedbackTags: z.array(z.string().max(50)).max(10).optional().default([]),
  comment: z.string().trim().min(10).max(1000),
  recommendation: z.enum(['Definitely!', 'Maybe', 'Not this time']).optional(),
  honeypot: z.string().max(0).optional()
});

const sanitize = str => String(str || '').replace(/<[^>]*>/g, '').trim();

test('Customer Review Submission - Valid full submission', () => {
  const input = {
    customerName: 'Ananya Sharma',
    customerEmail: 'ananya@example.com',
    productName: 'Dear Misu Classic (200g)',
    overallRating: 5,
    tasteRating: 5,
    creaminessRating: 5,
    coffeeIntensityRating: 4,
    sweetnessPreference: 'Just right',
    feedbackTags: ['Perfectly creamy', 'Rich coffee flavour'],
    comment: 'The best tiramisu in the city! Every single spoonful felt completely heavenly.',
    recommendation: 'Definitely!',
    honeypot: ''
  };
  const result = reviewSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.equal(result.data.customerName, 'Ananya Sharma');
  assert.equal(result.data.overallRating, 5);
});

test('Customer Review Submission - Missing customer name fails', () => {
  const input = {
    customerName: '',
    productName: 'Dear Misu Classic (200g)',
    overallRating: 5,
    comment: 'Delicious dessert, loved the coffee layers!'
  };
  const result = reviewSchema.safeParse(input);
  assert.equal(result.success, false);
});

test('Customer Review Submission - Missing product fails', () => {
  const input = {
    customerName: 'Rahul',
    productName: 'Invalid Cake',
    overallRating: 5,
    comment: 'Delicious dessert, loved the coffee layers!'
  };
  const result = reviewSchema.safeParse(input);
  assert.equal(result.success, false);
});

test('Customer Review Submission - Missing or out of range overall rating fails', () => {
  assert.equal(reviewSchema.safeParse({ customerName: 'Rahul', productName: 'Dear Misu Mini (100g)', comment: 'Great tiramisu!', overallRating: 0 }).success, false);
  assert.equal(reviewSchema.safeParse({ customerName: 'Rahul', productName: 'Dear Misu Mini (100g)', comment: 'Great tiramisu!', overallRating: 6 }).success, false);
  assert.equal(reviewSchema.safeParse({ customerName: 'Rahul', productName: 'Dear Misu Mini (100g)', comment: 'Great tiramisu!' }).success, false);
});

test('Customer Review Submission - Comment below 10 characters fails', () => {
  const result = reviewSchema.safeParse({
    customerName: 'Rohan',
    productName: 'Dear Misu Mini (100g)',
    overallRating: 4,
    comment: 'Good'
  });
  assert.equal(result.success, false);
});

test('Customer Review Submission - Comment above 1000 characters fails', () => {
  const result = reviewSchema.safeParse({
    customerName: 'Rohan',
    productName: 'Dear Misu Mini (100g)',
    overallRating: 4,
    comment: 'a'.repeat(1001)
  });
  assert.equal(result.success, false);
});

test('Security - HTML sanitization strips malicious tags and scripts', () => {
  const dirty = '<script>alert("xss")</script>Delicious <b>tiramisu</b> <img src="x" onerror="evil()"/>';
  const clean = sanitize(dirty);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('<b>'), false);
  assert.equal(clean.includes('<img'), false);
  assert.equal(clean, 'alert("xss")Delicious tiramisu');
});

test('Anti-Spam - Honeypot detection identifies bot fill', () => {
  const input = {
    customerName: 'SpamBot',
    productName: 'Dear Misu Classic (200g)',
    overallRating: 5,
    comment: 'Click this link to win money right now!',
    honeypot: 'http://spam-link.com'
  };
  const result = reviewSchema.safeParse(input);
  assert.equal(result.success, false, 'Honeypot length > 0 is rejected by schema');
});

test('Admin Auth - Timing-safe secret comparison validates correctly', () => {
  const expectedSecret = 'dear-misu-super-secret-key-2026';
  
  function checkSecret(supplied) {
    const a = Buffer.from(supplied || '');
    const b = Buffer.from(expectedSecret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  assert.equal(checkSecret('dear-misu-super-secret-key-2026'), true);
  assert.equal(checkSecret('wrong-secret'), false);
  assert.equal(checkSecret(''), false);
  assert.equal(checkSecret(null), false);
});

test('Admin Auth - Bearer token and custom header parsing', () => {
  const expectedSecret = 'dear-misu-super-secret-key-2026';

  function verifyAdminAuth(headers) {
    const authHeader = headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const supplied = headers['x-admin-status-secret'] || bearerToken || '';
    const a = Buffer.from(supplied);
    const b = Buffer.from(expectedSecret);
    return expectedSecret.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  assert.equal(verifyAdminAuth({ 'x-admin-status-secret': 'dear-misu-super-secret-key-2026' }), true);
  assert.equal(verifyAdminAuth({ 'authorization': 'Bearer dear-misu-super-secret-key-2026' }), true);
  assert.equal(verifyAdminAuth({ 'authorization': 'Bearer invalid-token' }), false);
  assert.equal(verifyAdminAuth({}), false);
  assert.equal(verifyAdminAuth({ 'x-admin-status-secret': 'wrong' }), false);
});

test('Admin Login - Credential verification rejects invalid username or secret', () => {
  const expectedSecret = 'dear-misu-super-secret-key-2026';

  function authenticateAdmin(username, secretKey) {
    const user = (username || 'admin').trim().toLowerCase();
    if (username && user !== 'admin') return { success: false, reason: 'Invalid username' };
    const a = Buffer.from((secretKey || '').trim());
    const b = Buffer.from(expectedSecret);
    if (!expectedSecret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { success: false, reason: 'Invalid secret' };
    }
    return { success: true, role: 'administrator' };
  }

  assert.equal(authenticateAdmin('admin', 'dear-misu-super-secret-key-2026').success, true);
  assert.equal(authenticateAdmin('ADMIN', 'dear-misu-super-secret-key-2026').success, true);
  assert.equal(authenticateAdmin('hacker', 'dear-misu-super-secret-key-2026').success, false);
  assert.equal(authenticateAdmin('admin', 'wrong-password').success, false);
  assert.equal(authenticateAdmin('admin', '').success, false);
});

test('Admin Auth - HMAC signed session token creation and verification', () => {
  const secret = 'dear-misu-super-secret-key-2026';
  const maxAgeMs = 12 * 60 * 60 * 1000;

  function createToken(username, issuedOffset = 0) {
    const ts = (Date.now() + issuedOffset).toString(36);
    const payload = `${ts}.${username}`;
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}.${sig}`;
  }

  function verifyToken(token) {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [ts, username, sig] = parts;
    const payload = `${ts}.${username}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const issuedAt = parseInt(ts, 36);
    if (Date.now() - issuedAt > maxAgeMs) return false;
    return true;
  }

  // 1. Valid token
  const validToken = createToken('admin');
  assert.equal(verifyToken(validToken), true);

  // 2. Tampered token payload
  const tampered = validToken.replace('admin', 'hacker');
  assert.equal(verifyToken(tampered), false);

  // 3. Expired token (13 hours old)
  const expiredToken = createToken('admin', -(13 * 60 * 60 * 1000));
  assert.equal(verifyToken(expiredToken), false);

  // 4. Malformed token
  assert.equal(verifyToken('malformed.token'), false);
  assert.equal(verifyToken(''), false);
  assert.equal(verifyToken(null), false);
});

test('Stats Calculation - Star percentages and average are mathematically sound', () => {
  const distribution = { 5: 18, 4: 5, 3: 1, 2: 0, 1: 0 };
  const total = Object.values(distribution).reduce((a, b) => a + b, 0); // 24
  assert.equal(total, 24);

  const sumRatings = 5 * 18 + 4 * 5 + 3 * 1; // 90 + 20 + 3 = 113
  const avg = parseFloat((sumRatings / total).toFixed(2)); // 4.71
  assert.equal(avg, 4.71);

  const pct5 = Math.round((distribution[5] / total) * 100); // 75%
  assert.equal(pct5, 75);
});

test('Review Ordering - Default chronological ordering sorts earliest to latest (15 Nov before 18 Nov)', () => {
  const reviews = [
    { id: '1', customer_name: 'Priya Iyer', created_at: '2026-11-18T08:29:18.899Z' },
    { id: '2', customer_name: 'Ananya Sharma', created_at: '2026-11-15T14:29:18.899Z' },
    { id: '3', customer_name: 'Vikram Mehta', created_at: '2026-11-13T10:00:00.000Z' }
  ];

  // Oldest first (chronological order)
  const sorted = [...reviews].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  assert.equal(sorted[0].customer_name, 'Vikram Mehta');
  assert.equal(sorted[1].customer_name, 'Ananya Sharma');
  assert.equal(sorted[2].customer_name, 'Priya Iyer');
  assert.ok(new Date(sorted[1].created_at) < new Date(sorted[2].created_at));
});

test('Admin Approval - Automatically grants verified purchase badge on approval', () => {
  const pendingReview = {
    id: 'test-123',
    customer_name: 'Priya Iyer',
    status: 'PENDING',
    verified_purchase: false
  };

  function approveReview(rev, moderatedBy = 'Store Admin') {
    return {
      ...rev,
      status: 'APPROVED',
      verified_purchase: true,
      moderated_at: new Date().toISOString(),
      moderated_by: moderatedBy
    };
  }

  const approved = approveReview(pendingReview);
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.verified_purchase, true);
  assert.ok(approved.moderated_at);
});

