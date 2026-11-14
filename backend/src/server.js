require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
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
  orderRef: z.string().regex(/^TIRA-\d{4,}$/).optional(),
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

/**
 * Generate a sequential order reference like TIRA-0001, TIRA-0002, etc.
 * Uses a PostgreSQL sequence to guarantee uniqueness and ordering.
 */
async function generateOrderRef(client) {
  const { rows } = await client.query("SELECT nextval('order_seq') AS seq");
  const seq = Number(rows[0].seq);
  return `TIRA-${String(seq).padStart(4, '0')}`;
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'tiramio-api', timestamp: new Date().toISOString() }));

app.get('/api/orders/next-ref', asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    const ref = await generateOrderRef(client);
    res.json({ orderRef: ref });
  } finally { client.release(); }
}));

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
        `INSERT INTO order_items (order_id, product_id, product_name, weight_grams, unit_price_paise, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [inserted.rows[0].id, item.product.id, item.product.name, item.product.weight_grams, item.product.price_paise, item.quantity]
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
  const items = await pool.query('SELECT product_name, weight_grams, quantity, unit_price_paise FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_ref = $1)', [order.order_ref]);
  const events = await pool.query(`SELECT status, note, created_at FROM order_status_events WHERE order_id = (SELECT id FROM orders WHERE order_ref = $1) ORDER BY created_at ASC`, [order.order_ref]);
  res.json({ orderRef: order.order_ref, customerName: order.customer_name, fulfilment: order.fulfilment, status: order.status, paymentMethod: order.payment_method, paymentId: order.payment_id, paymentStatus: order.payment_status, total: order.total_paise / 100, items: items.rows, events: events.rows, createdAt: order.created_at, updatedAt: order.updated_at });
}));

app.post('/api/payments/confirm-upi', asyncRoute(async (req, res) => {
  const schema = z.object({
    orderRef: z.string().regex(/^TIRA-\d{4,}$/),
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

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ message: status === 500 ? 'Something went wrong. Please try again.' : err.message });
});

app.listen(port, () => console.log(`TiraMio API listening on port ${port}`));
