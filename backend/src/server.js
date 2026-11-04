require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const Razorpay = require('razorpay');
const { z } = require('zod');
const { pool } = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); } }));
app.use(express.json({ limit: '100kb', verify: (req, res, buffer) => { req.rawBody = buffer; } }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false }));

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null;

const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  fulfilment: z.enum(['Pickup', 'Delivery']),
  address: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(z.object({ productId: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/), quantity: z.number().int().min(1).max(20) })).min(1).max(20)
}).refine(data => data.fulfilment !== 'Delivery' || Boolean(data.address?.trim()), { message: 'Delivery address is required for delivery orders.', path: ['address'] });

const orderRef = () => `TIRA-${crypto.randomInt(100000, 999999)}`;
const toPaise = rupees => Math.round(Number(rupees) * 100);
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/health', (req, res) => res.json({ ok: true, service: 'tiramio-api', timestamp: new Date().toISOString() }));

app.get('/api/products', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT slug, name, weight_grams, price_paise, short_description, badge, image_url, active FROM products WHERE active = true ORDER BY sort_order');
  res.json({ products: rows.map(row => ({ id: row.slug, name: row.name, weightGrams: row.weight_grams, price: row.price_paise / 100, shortDescription: row.short_description, badge: row.badge, imageUrl: row.image_url })) });
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Please check the order details.', errors: parsed.error.flatten() });
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slugs = data.items.map(item => item.productId);
    const { rows: products } = await client.query('SELECT id, slug, name, weight_grams, price_paise FROM products WHERE slug = ANY($1::text[]) AND active = true FOR SHARE', [slugs]);
    if (products.length !== new Set(slugs).size) throw Object.assign(new Error('One or more selected products are not currently available.'), { statusCode: 409 });
    const productMap = new Map(products.map(p => [p.slug, p]));
    const items = data.items.map(item => ({ product: productMap.get(item.productId), quantity: item.quantity }));
    const total = items.reduce((sum, item) => sum + item.product.price_paise * item.quantity, 0);
    const ref = orderRef();
    const inserted = await client.query(
      `INSERT INTO orders (order_ref, customer_name, phone, fulfilment, delivery_address, notes, status, total_paise)
       VALUES ($1,$2,$3,$4,$5,$6,'placed',$7) RETURNING id, order_ref, status, total_paise, created_at`,
      [ref, data.customerName, data.phone, data.fulfilment, data.address || null, data.notes || null, total]
    );
    await client.query(
      `INSERT INTO order_status_events (order_id, status, note) VALUES ($1, 'placed', 'Order request received')`,
      [inserted.rows[0].id]
    );
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, weight_grams, unit_price_paise, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [inserted.rows[0].id, item.product.id, item.product.name, item.product.weight_grams, item.product.price_paise, item.quantity]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ orderRef: ref, status: 'placed', total: total / 100, createdAt: inserted.rows[0].created_at });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

app.get('/api/orders/:orderRef/track', asyncRoute(async (req, res) => {
  const phone = String(req.query.phone || '');
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ message: 'A valid 10-digit mobile number is required.' });
  const { rows } = await pool.query(
    `SELECT order_ref, customer_name, fulfilment, status, total_paise, created_at, updated_at
     FROM orders WHERE order_ref = $1 AND phone = $2`, [req.params.orderRef.toUpperCase(), phone]
  );
  if (!rows.length) return res.status(404).json({ message: 'No matching order was found. Check the reference and phone number.' });
  const order = rows[0];
  const items = await pool.query('SELECT product_name, weight_grams, quantity, unit_price_paise FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_ref = $1)', [order.order_ref]);
  const events = await pool.query(`SELECT status, note, created_at FROM order_status_events WHERE order_id = (SELECT id FROM orders WHERE order_ref = $1) ORDER BY created_at ASC`, [order.order_ref]);
  res.json({ orderRef: order.order_ref, customerName: order.customer_name, fulfilment: order.fulfilment, status: order.status, total: order.total_paise / 100, items: items.rows, events: events.rows, createdAt: order.created_at, updatedAt: order.updated_at });
}));

app.post('/api/payments/create-order', asyncRoute(async (req, res) => {
  if (!razorpay) return res.status(503).json({ message: 'Online payment is not configured yet. Please use WhatsApp ordering and pay on pickup or delivery.' });
  const schema = z.object({ orderRef: z.string().regex(/^TIRA-\d{6}$/), phone: z.string().regex(/^[6-9]\d{9}$/) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid order reference or phone number.' });
  const { rows } = await pool.query('SELECT id, total_paise FROM orders WHERE order_ref=$1 AND phone=$2 AND status <> $3', [parsed.data.orderRef, parsed.data.phone, 'cancelled']);
  if (!rows.length) return res.status(404).json({ message: 'Order not found.' });
  const order = rows[0];
  const gatewayOrder = await razorpay.orders.create({ amount: order.total_paise, currency: 'INR', receipt: parsed.data.orderRef, notes: { orderRef: parsed.data.orderRef } });
  await pool.query(
    `INSERT INTO payments (order_id, gateway, gateway_order_id, amount_paise, currency, status)
     VALUES ($1,'razorpay',$2,$3,'INR','created')
     ON CONFLICT (gateway_order_id) DO NOTHING`,
    [order.id, gatewayOrder.id, order.total_paise]
  );
  await pool.query("UPDATE orders SET payment_status='pending', updated_at=now() WHERE id=$1", [order.id]);
  res.json({ keyId: process.env.RAZORPAY_KEY_ID, gatewayOrderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency });
}));

app.post('/api/payments/verify', asyncRoute(async (req, res) => {
  if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Payment verification is not configured.' });
  const schema = z.object({ orderRef: z.string().regex(/^TIRA-\d{6}$/), phone: z.string().regex(/^[6-9]\d{9}$/), razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payment verification payload.' });
  const data = parsed.data;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`).digest('hex');
  const received = Buffer.from(data.razorpay_signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const valid = received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
  if (!valid) return res.status(400).json({ verified: false, message: 'Payment signature verification failed.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payment = await client.query('SELECT p.id, p.order_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.gateway_order_id=$1 AND o.order_ref=$2 AND o.phone=$3 FOR UPDATE', [data.razorpay_order_id, data.orderRef, data.phone]);
    if (!payment.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ verified: false, message: 'Payment does not match this order.' }); }
    await client.query("UPDATE payments SET gateway_payment_id=$1, status='paid', signature_verified=true, updated_at=now() WHERE id=$2", [data.razorpay_payment_id, payment.rows[0].id]);
    await client.query("UPDATE orders SET payment_status='paid', updated_at=now() WHERE id=$1", [payment.rows[0].order_id]);
    await client.query('COMMIT');
    res.json({ verified: true, orderRef: data.orderRef });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.post('/api/payments/webhook', asyncRoute(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret) return res.status(503).json({ message: 'Payment webhook is not configured.' });
  const signature = req.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const valid = actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  if (!valid) return res.status(400).json({ message: 'Invalid webhook signature.' });

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity;
  if (!entity?.order_id) return res.status(200).json({ received: true, ignored: true });
  if (event === 'payment.captured' || event === 'payment.failed') {
    const paid = event === 'payment.captured';
    await pool.query(
      `UPDATE payments SET gateway_payment_id=$1, status=$2, signature_verified=true, updated_at=now() WHERE gateway_order_id=$3`,
      [entity.id || null, paid ? 'paid' : 'failed', entity.order_id]
    );
    await pool.query(
      `UPDATE orders SET payment_status=$1, updated_at=now() WHERE id=(SELECT order_id FROM payments WHERE gateway_order_id=$2)`,
      [paid ? 'paid' : 'failed', entity.order_id]
    );
  }
  res.status(200).json({ received: true });
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

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ message: status === 500 ? 'Something went wrong. Please try again.' : err.message });
});

app.listen(port, () => console.log(`TiraMio API listening on port ${port}`));
