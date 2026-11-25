require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { z } = require('zod');
const { pool } = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); } }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false }));

const orderSchema = z.object({
  orderRef: z.string().regex(/^(DEAR|TIRA)-\d{4,}$/).optional(),
  customerName: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  fulfilment: z.enum(['Pickup', 'Delivery']),
  address: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  payment: z.string().optional().default('UPI payment'),
  upiId: z.string().trim().max(100).nullable().optional(),
  paymentId: z.string().trim().min(4).max(100).nullable().optional(),
  items: z.array(z.object({ productId: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/), quantity: z.number().int().min(1).max(20) })).min(1).max(20)
}).refine(data => data.fulfilment !== 'Delivery' || Boolean(data.address?.trim()), { message: 'Delivery address is required for delivery orders.', path: ['address'] });

const toPaise = rupees => Math.round(Number(rupees) * 100);
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const sanitize = str => String(str || '').replace(/<[^>]*>/g, '').trim();

/* ---------- Multer (review image uploads) ---------- */
const uploadDir = path.join(process.env.VERCEL ? '/tmp' : __dirname, '..', 'uploads', 'reviews');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

/* ---------- Admin session tokens ---------- */
// Generate HMAC-signed session tokens instead of returning the raw secret.
// Token format: timestamp.signature  (signature = HMAC-SHA256(secret, timestamp+username))
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function createAdminToken(username) {
  const secret = process.env.ADMIN_STATUS_SECRET || '';
  const ts = Date.now().toString(36);
  const payload = `${ts}.${username}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  const secret = process.env.ADMIN_STATUS_SECRET || '';
  if (!secret || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ts, username, sig] = parts;
  const payload = `${ts}.${username}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // Timing-safe comparison of signatures
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  // Check expiration
  const issuedAt = parseInt(ts, 36);
  if (Date.now() - issuedAt > ADMIN_SESSION_MAX_AGE_MS) return false;
  return true;
}

/* ---------- Reusable admin auth ---------- */
function requireAdmin(req, res) {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const supplied = req.get('x-admin-status-secret') || bearerToken || '';

  // Accept either a session token (new) or the raw secret (backward-compat for existing admin APIs)
  if (supplied && verifyAdminToken(supplied)) return true;

  const expected = process.env.ADMIN_STATUS_SECRET || '';
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (expected && a.length === b.length && crypto.timingSafeEqual(a, b)) return true;

  res.status(401).json({ message: 'Unauthorized. Admin privileges required.' });
  return false;
}

/* ---------- Login rate limiter (brute-force protection) ---------- */
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  limit: 7,              // max 7 attempts per window
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown'
});

/* ---------- ADMIN: POST /api/admin/login ---------- */
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const body = req.body || {};
  const secretKey = (body.secretKey || body.password || body.secret || '').trim();
  const username = (body.username || 'admin').trim().toLowerCase();
  const expected = process.env.ADMIN_STATUS_SECRET || '';

  // Generic error message – don't reveal which field was wrong
  const denyMsg = 'Invalid administrative credentials. Access denied.';

  if (!secretKey || !username) {
    return res.status(401).json({ success: false, message: denyMsg });
  }

  if (username !== ADMIN_USERNAME) {
    return res.status(401).json({ success: false, message: denyMsg });
  }

  const a = Buffer.from(secretKey);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: denyMsg });
  }

  // Issue a signed session token (NOT the raw secret)
  const token = createAdminToken(username);

  res.json({
    success: true,
    token,
    expiresIn: ADMIN_SESSION_MAX_AGE_MS,
    admin: {
      username,
      role: 'administrator',
      authenticatedAt: new Date().toISOString()
    }
  });
});

/* ---------- ADMIN: GET /api/admin/verify ---------- */
app.get('/api/admin/verify', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    authenticated: true,
    role: 'administrator',
    user: 'admin',
    verifiedAt: new Date().toISOString()
  });
});

/* ---------- Review rate limiter ---------- */
const reviewLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 3, message: { message: 'Too many reviews submitted. Please try again later.' }, standardHeaders: 'draft-7', legacyHeaders: false });

/**
 * Generate a sequential order reference like DEAR-0001, DEAR-0002, etc.
 * Uses a PostgreSQL sequence to guarantee uniqueness and ordering.
 */
async function generateOrderRef(client) {
  const { rows } = await client.query("SELECT nextval('order_seq') AS seq");
  const seq = Number(rows[0].seq);
  return `DEAR-${String(seq).padStart(4, '0')}`;
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'dear-misu-api', timestamp: new Date().toISOString() }));

app.get('/api/orders/next-ref', asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    const ref = await generateOrderRef(client);
    res.json({ orderRef: ref });
  } finally { client.release(); }
}));

app.get('/api/products', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT slug, name, price_paise, short_description, badge, image_url, active FROM products WHERE active = true ORDER BY sort_order');
  res.json({ products: rows.map(row => ({ id: row.slug, name: row.name, price: row.price_paise / 100, shortDescription: row.short_description, badge: row.badge, imageUrl: row.image_url })) });
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Please check the order details.', errors: parsed.error.flatten() });
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slugs = data.items.map(item => item.productId);
    const { rows: products } = await client.query('SELECT id, slug, name, price_paise FROM products WHERE slug = ANY($1::text[]) AND active = true FOR SHARE', [slugs]);
    if (products.length !== new Set(slugs).size) throw Object.assign(new Error('One or more selected products are not currently available.'), { statusCode: 409 });
    const productMap = new Map(products.map(p => [p.slug, p]));
    const items = data.items.map(item => ({ product: productMap.get(item.productId), quantity: item.quantity }));
    const total = items.reduce((sum, item) => sum + item.product.price_paise * item.quantity, 0);
    const ref = data.orderRef || await generateOrderRef(client);
    const isPaid = Boolean(data.paymentId);
    const paymentStatus = isPaid ? 'paid' : (data.payment === 'Pay on pickup / delivery' ? 'unpaid' : 'pending');
    const inserted = await client.query(
      `INSERT INTO orders (order_ref, customer_name, phone, fulfilment, delivery_address, notes, payment_method, upi_id, payment_id, status, payment_status, total_paise)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'placed',$10,$11) RETURNING id, order_ref, status, total_paise, created_at`,
      [ref, data.customerName, data.phone, data.fulfilment, data.address || null, data.notes || null, data.payment, data.upiId || null, data.paymentId || null, paymentStatus, total]
    );
    await client.query(
      `INSERT INTO order_status_events (order_id, status, note) VALUES ($1, 'placed', $2)`,
      [inserted.rows[0].id, isPaid ? `Order placed with UPI Payment (UTR: ${data.paymentId})` : 'Order request received']
    );
    if (isPaid) {
      await client.query(
        `INSERT INTO payments (order_id, gateway, gateway_order_id, amount_paise, currency, status, signature_verified)
         VALUES ($1, 'upi', $2, $3, 'INR', 'paid', true)
         ON CONFLICT (gateway_order_id) DO NOTHING`,
        [inserted.rows[0].id, data.paymentId, total]
      );
    }
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_paise, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [inserted.rows[0].id, item.product.id, item.product.name, item.product.price_paise, item.quantity]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ orderRef: ref, status: 'placed', total: total / 100, paymentMethod: data.payment, createdAt: inserted.rows[0].created_at });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

app.get('/api/orders/:orderRef/track', asyncRoute(async (req, res) => {
  const phone = String(req.query.phone || '');
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ message: 'A valid 10-digit mobile number is required.' });
  const { rows } = await pool.query(
    `SELECT order_ref, customer_name, fulfilment, status, payment_method, upi_id, payment_id, payment_status, total_paise, created_at, updated_at
     FROM orders WHERE order_ref = $1 AND phone = $2`, [req.params.orderRef.toUpperCase(), phone]
  );
  if (!rows.length) return res.status(404).json({ message: 'No matching order was found. Check the reference and phone number.' });
  const order = rows[0];
  const items = await pool.query('SELECT product_name, quantity, unit_price_paise FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_ref = $1)', [order.order_ref]);
  const events = await pool.query(`SELECT status, note, created_at FROM order_status_events WHERE order_id = (SELECT id FROM orders WHERE order_ref = $1) ORDER BY created_at ASC`, [order.order_ref]);
  res.json({ orderRef: order.order_ref, customerName: order.customer_name, fulfilment: order.fulfilment, status: order.status, paymentMethod: order.payment_method, paymentId: order.payment_id, paymentStatus: order.payment_status, total: order.total_paise / 100, items: items.rows, events: events.rows, createdAt: order.created_at, updatedAt: order.updated_at });
}));

app.post('/api/payments/confirm-upi', asyncRoute(async (req, res) => {
  const schema = z.object({
    orderRef: z.string().regex(/^(DEAR|TIRA)-\d{4,}$/),
    transactionId: z.string().min(4).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payment confirmation details.' });

  const supplied = req.get('x-admin-status-secret') || '';
  const expected = process.env.ADMIN_STATUS_SECRET || '';
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: 'Unauthorized.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id FROM orders WHERE order_ref=$1 FOR UPDATE', [parsed.data.orderRef.toUpperCase()]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found.' }); }
    await client.query(
      `INSERT INTO payments (order_id, gateway, gateway_order_id, amount_paise, currency, status, signature_verified)
       VALUES ($1, 'upi', $2, (SELECT total_paise FROM orders WHERE id=$1), 'INR', 'paid', true)
       ON CONFLICT (gateway_order_id) DO NOTHING`,
      [rows[0].id, parsed.data.transactionId]
    );
    await client.query("UPDATE orders SET payment_status='paid', updated_at=now() WHERE id=$1", [rows[0].id]);
    await client.query('INSERT INTO order_status_events (order_id, status, note) VALUES ($1, (SELECT status FROM orders WHERE id=$1), $2)', [rows[0].id, `UPI payment confirmed: ${parsed.data.transactionId}`]);
    await client.query('COMMIT');
    res.json({ confirmed: true, orderRef: parsed.data.orderRef });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.patch('/api/admin/orders/:orderRef/status', asyncRoute(async (req, res) => {
  const supplied = req.get('x-admin-status-secret') || '';
  const expected = process.env.ADMIN_STATUS_SECRET || '';
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: 'Unauthorized.' });
  const parsed = z.object({ status: z.enum(['placed','confirmed','preparing','out_for_delivery','delivered','cancelled']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid order status.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('UPDATE orders SET status=$1, updated_at=now() WHERE order_ref=$2 RETURNING id, order_ref, status', [parsed.data.status, req.params.orderRef.toUpperCase()]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found.' }); }
    await client.query('INSERT INTO order_status_events (order_id, status, note) VALUES ($1,$2,$3)', [rows[0].id, parsed.data.status, `Status updated to ${parsed.data.status.replaceAll('_', ' ')}`]);
    await client.query('COMMIT');
    res.json({ orderRef: rows[0].order_ref, status: rows[0].status });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

/* ================================================================
 *  CUSTOMER REVIEWS & AUTHENTICITY SYSTEM
 * ================================================================ */

const PRODUCT_SLUG_MAP = {
  'Dear Misu Mini': 'mini',
  'Dear Misu Classic': 'classic',
  'Dear Misu Share Box': 'share',
};

const reviewSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.string().email().optional().or(z.literal('')).nullable(),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')).nullable(),
  orderRef: z.string().regex(/^(DEAR|TIRA)-\d{4,}$/i).optional().or(z.literal('')).nullable(),
  productName: z.enum(['Dear Misu Mini', 'Dear Misu Classic', 'Dear Misu Share Box']),
  overallRating: z.coerce.number().int().min(1).max(5),
  tasteRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  creaminessRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  coffeeIntensityRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  sweetnessRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  textureRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  chocolateRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  presentationRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  sweetnessPreference: z.enum(['Too sweet', 'Just right', 'Less sweet']).optional().nullable(),
  coffeePreference: z.enum(['Mild', 'Balanced', 'Strong']).optional().nullable(),
  texturePreference: z.enum(['Extra creamy', 'Soft and fluffy', 'Rich and layered', 'Perfectly balanced']).optional().nullable(),
  feedbackTags: z.array(z.string().max(50)).max(10).optional().default([]),
  comment: z.string().trim().min(10).max(1000),
  recommendation: z.enum(['Definitely!', 'Maybe', 'Not this time']).optional().nullable(),
  honeypot: z.string().max(0).optional()
});

function hashToken(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex');
}

function detectSuspiciousText(comment) {
  const text = String(comment || '').trim();
  if (/(.)\1{5,}/i.test(text)) return 'Suspicious repetitive character sequence';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1 && text.length >= 10 && !/[aeiou]/i.test(text)) return 'Suspicious placeholder text';
  if (words.length <= 2 && /[bcdfghjklmnpqrstvwxyz]{6,}/i.test(text)) return 'Suspicious consonant-mash placeholder';
  return null;
}

async function verifyPurchasePg(client, { orderRef, customerPhone, productName }) {
  const cleanRef = String(orderRef || '').trim().toUpperCase();
  const cleanPhone = String(customerPhone || '').replace(/\D/g, '').slice(-10);
  if (!cleanRef && !cleanPhone) {
    return { verified: false, reason: 'No order reference or mobile number provided.' };
  }

  let orderRes;
  if (cleanRef) {
    if (!cleanPhone) {
      return { verified: false, reason: 'Matching mobile number is required with order reference.' };
    }
    orderRes = await client.query(
      `SELECT o.id AS order_id, o.order_ref, o.updated_at AS delivered_at, oi.id AS order_item_id, oi.product_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.order_ref = $1 AND o.phone = $2 AND o.status = 'delivered' AND oi.product_name = $3
       LIMIT 1`,
      [cleanRef, cleanPhone, productName]
    );
  } else {
    orderRes = await client.query(
      `SELECT o.id AS order_id, o.order_ref, o.updated_at AS delivered_at, oi.id AS order_item_id, oi.product_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.phone = $1 AND o.status = 'delivered' AND oi.product_name = $2
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [cleanPhone, productName]
    );
  }

  if (!orderRes.rows.length) {
    return { verified: false, reason: 'No completed delivered order matched this product and customer.' };
  }

  const row = orderRes.rows[0];
  return {
    verified: true,
    orderId: row.order_id,
    orderRef: row.order_ref,
    orderItemId: row.order_item_id,
    deliveredAt: row.delivered_at,
    matchedBy: cleanRef ? 'order_ref+phone' : 'phone',
    verifiedAt: new Date().toISOString()
  };
}

/* ---------- POST /api/reviews – Submit a review ---------- */
app.post('/api/reviews', reviewLimiter, upload.single('image'), asyncRoute(async (req, res) => {
  const body = { ...req.body };
  if (typeof body.feedbackTags === 'string') {
    try { body.feedbackTags = JSON.parse(body.feedbackTags); } catch { body.feedbackTags = []; }
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ message: 'Please check the review details.', errors: parsed.error.flatten() });
  const data = parsed.data;

  // Honeypot spam trap – silently accept
  if (data.honeypot) return res.status(200).json({ message: 'Thank you for your review!' });

  const customerName = sanitize(data.customerName);
  const comment = sanitize(data.comment);
  const cleanPhone = data.customerPhone ? String(data.customerPhone).replace(/\D/g, '').slice(-10) : null;
  const cleanEmail = data.customerEmail ? String(data.customerEmail).trim().toLowerCase() : null;
  const cleanOrderRef = data.orderRef ? String(data.orderRef).trim().toUpperCase() : null;
  const productId = PRODUCT_SLUG_MAP[data.productName] || null;
  const customerId = cleanPhone || cleanEmail || null;
  const editToken = crypto.randomBytes(24).toString('hex');
  const suspiciousReason = detectSuspiciousText(comment);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const verification = await verifyPurchasePg(client, { orderRef: cleanOrderRef, customerPhone: cleanPhone, productName: data.productName });

    if (verification.verified) {
      const dupCheck = await client.query(
        'SELECT id FROM customer_reviews WHERE order_id = $1 AND product_name = $2 LIMIT 1',
        [verification.orderId, data.productName]
      );
      if (dupCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: 'A review has already been submitted for this product on this order.',
          existingReviewId: dupCheck.rows[0].id
        });
      }
    }

    const verStatus = verification.verified ? 'VERIFIED_PURCHASE' : 'UNVERIFIED';
    const evidence = verification.verified ? JSON.stringify(verification) : null;

    const { rows } = await client.query(
      `INSERT INTO customer_reviews
         (customer_id, product_id, order_id, order_ref, order_item_id,
          customer_name, customer_email, customer_phone, product_name, overall_rating,
          taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
          texture_rating, chocolate_rating, presentation_rating,
          sweetness_preference, coffee_preference, texture_preference,
          feedback_tags, comment, customer_image_url, recommendation,
          status, verified_purchase, purchase_verification_status, verification_evidence,
          flagged_for_review, flag_reason, edit_token_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NULL,$23,'PENDING',$24,$25,$26,$27,$28,$29)
       RETURNING id`,
      [
        customerId, productId, verification.verified ? verification.orderId : null,
        verification.verified ? verification.orderRef : cleanOrderRef,
        verification.verified ? verification.orderItemId : null,
        customerName, cleanEmail, cleanPhone, data.productName, data.overallRating,
        data.tasteRating || null, data.creaminessRating || null, data.coffeeIntensityRating || null, data.sweetnessRating || null,
        data.textureRating || null, data.chocolateRating || null, data.presentationRating || null,
        data.sweetnessPreference || null, data.coffeePreference || null, data.texturePreference || null,
        data.feedbackTags, comment, data.recommendation || null,
        Boolean(verification.verified), verStatus, evidence,
        Boolean(suspiciousReason), suspiciousReason, hashToken(editToken)
      ]
    );

    const reviewId = rows[0].id;
    await client.query(
      `INSERT INTO review_versions (review_id, version_number, overall_rating, comment, recommendation, edited_by)
       VALUES ($1, 1, $2, $3, $4, $5)`,
      [reviewId, data.overallRating, comment, data.recommendation || null, customerName]
    );
    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, new_status, metadata)
       VALUES ($1, 'customer', $2, 'SUBMITTED', 'PENDING', $3)`,
      [reviewId, customerId || customerName, JSON.stringify({ verificationStatus: verStatus })]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Thank you for your review! It is now awaiting moderation before publication.',
      reviewId,
      verificationStatus: verStatus,
      editToken
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

/* ---------- PATCH /api/reviews/:id – Authenticated Customer Edit ---------- */
app.patch('/api/reviews/:id', asyncRoute(async (req, res) => {
  const token = req.get('x-review-edit-token') || req.body?.editToken || '';
  if (!token) return res.status(401).json({ message: 'Edit token is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM customer_reviews WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Review not found.' });
    }
    const existing = rows[0];
    const suppliedHash = Buffer.from(hashToken(token));
    const storedHash = Buffer.from(existing.edit_token_hash || '');
    if (!existing.edit_token_hash || suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(suppliedHash, storedHash)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Invalid edit token.' });
    }

    const nextRating = req.body.overallRating ? Number(req.body.overallRating) : existing.overall_rating;
    const nextComment = req.body.comment ? sanitize(req.body.comment) : existing.comment;
    if (nextRating < 1 || nextRating > 5 || nextComment.length < 10 || nextComment.length > 1000) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid rating or comment length.' });
    }

    const { rows: updated } = await client.query(
      `UPDATE customer_reviews
       SET overall_rating = $2, comment = $3, recommendation = COALESCE($4, recommendation),
           status = 'PENDING', updated_at = now()
       WHERE id = $1 RETURNING id, customer_name, product_name, overall_rating, comment, status, verified_purchase, purchase_verification_status, created_at, updated_at`,
      [req.params.id, nextRating, nextComment, req.body.recommendation || null]
    );

    const verRes = await client.query('SELECT COALESCE(MAX(version_number), 0)::int AS max_v FROM review_versions WHERE review_id = $1', [req.params.id]);
    await client.query(
      `INSERT INTO review_versions (review_id, version_number, overall_rating, comment, recommendation, edited_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, verRes.rows[0].max_v + 1, nextRating, nextComment, req.body.recommendation || existing.recommendation, existing.customer_name]
    );
    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason)
       VALUES ($1, 'customer', $2, 'CUSTOMER_EDITED', $3, 'PENDING', 'Customer updated review')`,
      [req.params.id, existing.customer_id || existing.customer_name, existing.status]
    );

    await client.query('COMMIT');
    res.json({ message: 'Review updated and queued for moderation.', review: updated[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

/* ---------- GET /api/reviews – Public approved reviews ---------- */
app.get('/api/reviews', asyncRoute(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const conditions = ["status = 'APPROVED'"];
  const params = [];
  let idx = 1;

  if (req.query.product) { conditions.push(`product_name = $${idx++}`); params.push(req.query.product); }
  if (req.query.rating) { conditions.push(`overall_rating = $${idx++}`); params.push(parseInt(req.query.rating, 10)); }
  if (req.query.verification === 'VERIFIED_PURCHASE' || req.query.verification === 'verified') {
    conditions.push("purchase_verification_status = 'VERIFIED_PURCHASE'");
  }

  const sortParam = req.query.sort || 'chronological';
  const sortMap = {
    chronological: 'created_at DESC',
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    highest: 'overall_rating DESC, created_at DESC',
    lowest: 'overall_rating ASC, created_at DESC',
    helpful: 'helpful_count DESC, created_at DESC'
  };
  const orderBy = sortMap[sortParam] || sortMap.chronological;

  const where = conditions.join(' AND ');
  const countResult = await pool.query(`SELECT COUNT(*) FROM customer_reviews WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await pool.query(
    `SELECT id, customer_name, product_name, overall_rating,
            taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
            texture_rating, chocolate_rating, presentation_rating,
            sweetness_preference, coffee_preference, texture_preference,
            feedback_tags, comment, recommendation,
            verified_purchase, purchase_verification_status, helpful_count, created_at, updated_at, published_at
     FROM customer_reviews WHERE ${where}
     ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const finalRows = sortParam === 'chronological' || !sortMap[sortParam]
    ? [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    : rows;

  res.json({ reviews: finalRows, total, page, totalPages: Math.ceil(total / limit) || 1 });
}));

/* ---------- GET /api/reviews/stats – Public stats ---------- */
app.get('/api/reviews/stats', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COALESCE(ROUND(AVG(overall_rating), 2), 0) AS avg_rating,
       COUNT(*) FILTER (WHERE purchase_verification_status = 'VERIFIED_PURCHASE')::int AS verified_count,
       COUNT(*) FILTER (WHERE overall_rating = 5)::int AS stars_5,
       COUNT(*) FILTER (WHERE overall_rating = 4)::int AS stars_4,
       COUNT(*) FILTER (WHERE overall_rating = 3)::int AS stars_3,
       COUNT(*) FILTER (WHERE overall_rating = 2)::int AS stars_2,
       COUNT(*) FILTER (WHERE overall_rating = 1)::int AS stars_1,
       COUNT(*) FILTER (WHERE recommendation IN ('Definitely!','Maybe','Not this time'))::int AS rec_responses,
       COUNT(*) FILTER (WHERE recommendation = 'Definitely!')::int AS recommend_yes
     FROM customer_reviews WHERE status = 'APPROVED'`
  );
  const s = rows[0];
  const total = s.total || 0;
  const pct = n => total ? Math.round((n / total) * 100) : 0;
  const recPct = s.rec_responses > 0 ? Math.round((s.recommend_yes / s.rec_responses) * 100) : null;

  const productAvg = await pool.query(
    `SELECT product_name, ROUND(AVG(overall_rating), 2) AS avg_rating, COUNT(*)::int AS total
     FROM customer_reviews WHERE status = 'APPROVED' GROUP BY product_name`
  );

  res.json({
    averageRating: parseFloat(s.avg_rating),
    totalReviews: total,
    verifiedPurchaseCount: s.verified_count || 0,
    distribution: {
      5: { count: s.stars_5, percentage: pct(s.stars_5) },
      4: { count: s.stars_4, percentage: pct(s.stars_4) },
      3: { count: s.stars_3, percentage: pct(s.stars_3) },
      2: { count: s.stars_2, percentage: pct(s.stars_2) },
      1: { count: s.stars_1, percentage: pct(s.stars_1) }
    },
    recommendationPercentage: recPct,
    recommendationResponseCount: s.rec_responses || 0,
    productAverages: productAvg.rows
  });
}));

/* ---------- GET /api/reviews/:id – Single approved review ---------- */
app.get('/api/reviews/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, customer_name, product_name, overall_rating,
            taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
            texture_rating, chocolate_rating, presentation_rating,
            sweetness_preference, coffee_preference, texture_preference,
            feedback_tags, comment, recommendation,
            verified_purchase, purchase_verification_status, helpful_count, created_at
     FROM customer_reviews WHERE id = $1 AND status = 'APPROVED'`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Review not found.' });
  res.json({ review: rows[0] });
}));

/* ---------- POST /api/reviews/:id/helpful – Vote helpful ---------- */
app.post('/api/reviews/:id/helpful', asyncRoute(async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const voterIpHash = crypto.createHash('sha256').update(ip).digest('hex');

  const pubCheck = await pool.query("SELECT id, helpful_count FROM customer_reviews WHERE id = $1 AND status = 'APPROVED'", [req.params.id]);
  if (!pubCheck.rows.length) return res.status(404).json({ helpful: false, message: 'Published review not found.' });

  const { rowCount } = await pool.query(
    `INSERT INTO review_helpful_votes (review_id, voter_ip_hash)
     VALUES ($1, $2) ON CONFLICT (review_id, voter_ip_hash) DO NOTHING`,
    [req.params.id, voterIpHash]
  );

  if (rowCount > 0) {
    const upd = await pool.query('UPDATE customer_reviews SET helpful_count = helpful_count + 1 WHERE id = $1 RETURNING helpful_count', [req.params.id]);
    return res.json({ helpful: true, helpfulCount: upd.rows[0].helpful_count });
  }

  res.status(409).json({ helpful: false, duplicate: true, helpfulCount: pubCheck.rows[0].helpful_count });
}));

/* ---------- ADMIN: GET /api/admin/reviews ---------- */
app.get('/api/admin/reviews', asyncRoute(async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (req.query.status && req.query.status !== 'ALL') {
    if (req.query.status === 'REJECTED_OR_HIDDEN') {
      conditions.push("status IN ('REJECTED', 'HIDDEN')");
    } else {
      conditions.push(`status = $${idx++}`);
      params.push(req.query.status);
    }
  }
  if (req.query.product) { conditions.push(`product_name = $${idx++}`); params.push(req.query.product); }
  if (req.query.rating) { conditions.push(`overall_rating = $${idx++}`); params.push(parseInt(req.query.rating, 10)); }
  if (req.query.verification === 'VERIFIED_PURCHASE' || req.query.verification === 'UNVERIFIED') {
    conditions.push(`purchase_verification_status = $${idx++}`);
    params.push(req.query.verification);
  }
  if (req.query.flagged === 'true') {
    conditions.push('flagged_for_review = true');
  }
  if (req.query.search) {
    conditions.push(`(customer_name ILIKE $${idx} OR customer_email ILIKE $${idx} OR comment ILIKE $${idx} OR product_name ILIKE $${idx})`);
    params.push(`%${req.query.search}%`);
    idx++;
  }

  const sortMap = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    highest: 'overall_rating DESC, created_at DESC',
    lowest: 'overall_rating ASC, created_at DESC',
    helpful: 'helpful_count DESC, created_at DESC'
  };
  const orderBy = sortMap[req.query.sort] || sortMap.newest;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await pool.query(`SELECT COUNT(*) FROM customer_reviews ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await pool.query(
    `SELECT * FROM customer_reviews ${where}
     ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  res.json({ reviews: rows, total, page, totalPages: Math.ceil(total / limit) || 1 });
}));

/* ---------- ADMIN: GET /api/admin/reviews/stats ---------- */
app.get('/api/admin/reviews/stats', asyncRoute(async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
       COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
       COUNT(*) FILTER (WHERE status = 'HIDDEN')::int AS hidden,
       COUNT(*) FILTER (WHERE purchase_verification_status = 'VERIFIED_PURCHASE')::int AS verified_count,
       COUNT(*) FILTER (WHERE flagged_for_review = true)::int AS flagged_count,
       COALESCE(ROUND(AVG(overall_rating) FILTER (WHERE status = 'APPROVED'), 2), 0) AS avg_rating,
       COUNT(*) FILTER (WHERE status = 'APPROVED' AND recommendation IN ('Definitely!','Maybe','Not this time'))::int AS rec_responses,
       COUNT(*) FILTER (WHERE status = 'APPROVED' AND recommendation = 'Definitely!')::int AS recommend_yes
     FROM customer_reviews`
  );
  const s = rows[0];
  const total = s.total || 0;
  const recPct = s.rec_responses > 0 ? Math.round((s.recommend_yes / s.rec_responses) * 100) : null;

  res.json({
    total,
    pending: s.pending,
    approved: s.approved,
    rejected: s.rejected,
    hidden: s.hidden,
    rejectedOrHidden: (s.rejected || 0) + (s.hidden || 0),
    verifiedCount: s.verified_count || 0,
    unverifiedCount: total - (s.verified_count || 0),
    flaggedCount: s.flagged_count || 0,
    averageRating: parseFloat(s.avg_rating),
    recommendationPercentage: recPct,
    recommendationResponseCount: s.rec_responses || 0
  });
}));

/* ---------- ADMIN: GET /api/admin/reviews/:id – Full detail + audit + versions ---------- */
app.get('/api/admin/reviews/:id', asyncRoute(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rev = await pool.query('SELECT * FROM customer_reviews WHERE id = $1', [req.params.id]);
  if (!rev.rows.length) return res.status(404).json({ message: 'Review not found.' });
  const logs = await pool.query('SELECT * FROM review_audit_logs WHERE review_id = $1 ORDER BY created_at DESC', [req.params.id]);
  const versions = await pool.query('SELECT * FROM review_versions WHERE review_id = $1 ORDER BY version_number DESC', [req.params.id]);
  res.json({ review: rev.rows[0], auditLogs: logs.rows, versions: versions.rows });
}));

/* ---------- ADMIN: PATCH /api/admin/reviews/:id – Block rewriting customer opinions ---------- */
app.patch('/api/admin/reviews/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  return res.status(403).json({ message: 'Forbidden: Administrators cannot modify original customer review text, ratings, timestamps, or purchase verification.' });
});

async function runPgModeration(req, res, { action, targetStatus, requireReason, allowedPrev }) {
  if (!requireAdmin(req, res)) return;
  const moderatedBy = (req.body && req.body.moderatedBy) || 'admin';
  const reason = String((req.body && req.body.reason) || '').trim();
  if (requireReason && reason.length < 3) {
    return res.status(400).json({ message: `An internal moderation reason is required to ${action.toLowerCase()} a review.` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT * FROM customer_reviews WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!cur.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Review not found.' });
    }
    const prevStatus = cur.rows[0].status;
    if (allowedPrev && !allowedPrev.includes(prevStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Cannot ${action.toLowerCase()} a review in ${prevStatus} state.` });
    }

    const { rows } = await client.query(
      `UPDATE customer_reviews
       SET status = $2::review_status,
           moderation_reason = COALESCE(NULLIF($3, ''), moderation_reason),
           moderated_at = now(),
           moderated_by = $4,
           published_at = CASE WHEN $2 = 'APPROVED' AND published_at IS NULL THEN now() ELSE published_at END,
           flagged_for_review = CASE WHEN $2 = 'APPROVED' THEN false ELSE flagged_for_review END
       WHERE id = $1 RETURNING *`,
      [req.params.id, targetStatus, reason, moderatedBy]
    );

    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6)`,
      [req.params.id, moderatedBy, action, prevStatus, targetStatus, reason || null]
    );

    await client.query('COMMIT');
    res.json({ review: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

app.patch('/api/admin/reviews/:id/approve', asyncRoute((req, res) =>
  runPgModeration(req, res, { action: 'APPROVED', targetStatus: 'APPROVED', requireReason: false })
));

app.patch('/api/admin/reviews/:id/reject', asyncRoute((req, res) =>
  runPgModeration(req, res, { action: 'REJECTED', targetStatus: 'REJECTED', requireReason: true })
));

app.patch('/api/admin/reviews/:id/hide', asyncRoute((req, res) =>
  runPgModeration(req, res, { action: 'HIDDEN', targetStatus: 'HIDDEN', requireReason: true, allowedPrev: ['APPROVED'] })
));

app.patch('/api/admin/reviews/:id/restore', asyncRoute((req, res) =>
  runPgModeration(req, res, { action: 'RESTORED', targetStatus: 'APPROVED', requireReason: false, allowedPrev: ['HIDDEN', 'REJECTED'] })
));

/* ---------- ADMIN: DELETE /api/admin/reviews/:id ---------- */
app.delete('/api/admin/reviews/:id', asyncRoute(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const reasonCategory = String(req.body?.reasonCategory || req.query.reasonCategory || '').trim();
  const reason = String(req.body?.reason || req.query.reason || '').trim();
  const validCategories = new Set(['duplicate', 'privacy_erasure', 'legal_compliance', 'spam_fraud']);
  if (!validCategories.has(reasonCategory) || reason.length < 5) {
    return res.status(400).json({ message: 'Permanent deletion requires a valid retention/privacy/legal/duplicate reason category and explanation.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT * FROM customer_reviews WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!cur.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Review not found.' });
    }
    const target = cur.rows[0];
    if (target.overall_rating <= 2 && target.purchase_verification_status === 'VERIFIED_PURCHASE' && reasonCategory === 'spam_fraud') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Verified-purchase negative feedback cannot be deleted as spam.' });
    }

    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason)
       VALUES ($1, 'admin', 'admin', 'DELETED', $2, 'DELETED', $3)`,
      [req.params.id, target.status, `[${reasonCategory}] ${reason}`]
    );
    await client.query('DELETE FROM customer_reviews WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ deleted: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ message: status === 500 ? 'Something went wrong. Please try again.' : err.message });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => console.log(`DearMisu API listening on port ${port}`));
}

module.exports = app;
