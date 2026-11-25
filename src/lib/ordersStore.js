import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');
const DATA_DIR = IS_SERVERLESS ? path.join('/tmp', 'tiramio-data') : path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const PRODUCT_CATALOG = {
  mini: { id: 'mini', name: 'Dear Misu Mini', pricePaise: 11900 },
  classic: { id: 'classic', name: 'Dear Misu Classic', pricePaise: 17900 },
  share: { id: 'share', name: 'Dear Misu Share Box', pricePaise: 22900 },
};

let inMemoryOrders = null;
let ordersMemoryOnly = false;

function initOrdersStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ORDERS_FILE)) {
      if (fs.existsSync(BUNDLED_ORDERS_FILE)) {
        const seed = fs.readFileSync(BUNDLED_ORDERS_FILE, 'utf-8');
        fs.writeFileSync(ORDERS_FILE, seed, 'utf-8');
        return;
      }
      fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Orders store init notice (in-memory fallback):', err.message);
  }
}

export function readOrders() {
  if (ordersMemoryOnly && Array.isArray(inMemoryOrders)) {
    return inMemoryOrders;
  }
  try {
    initOrdersStore();
    if (fs.existsSync(ORDERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
      inMemoryOrders = Array.isArray(parsed) ? parsed : [];
      return inMemoryOrders;
    }
    if (fs.existsSync(BUNDLED_ORDERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BUNDLED_ORDERS_FILE, 'utf-8'));
      inMemoryOrders = Array.isArray(parsed) ? parsed : [];
      return inMemoryOrders;
    }
  } catch (err) {
    console.error('Error reading orders file:', err);
  }
  if (!Array.isArray(inMemoryOrders)) inMemoryOrders = [];
  return inMemoryOrders;
}

function writeOrders(orders) {
  inMemoryOrders = orders;
  try {
    initOrdersStore();
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    ordersMemoryOnly = false;
    return true;
  } catch (err) {
    ordersMemoryOnly = true;
    console.warn('Orders write notice (saved in memory):', err.message);
    return true;
  }
}

export function normalizeProductName(name) {
  return String(name || '').replace(/\s*\((100|200|300)g\)$/i, '').trim();
}

export function getNextOrderRef() {
  const orders = readOrders();
  let maxSeq = 1000;
  for (const ord of orders) {
    const m = String(ord.order_ref || '').match(/^(?:DEAR|TIRA)-(\d+)$/);
    if (m) {
      maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
  }
  return `DEAR-${String(maxSeq + 1).padStart(4, '0')}`;
}

export function createOrder(data) {
  const orders = readOrders();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const orderRef = (data.orderRef && String(data.orderRef).trim().toUpperCase()) || getNextOrderRef();

  const items = (data.items || []).map(item => {
    const cat = PRODUCT_CATALOG[item.productId] || {
      id: item.productId,
      name: item.productName || item.productId,
      pricePaise: 0
    };
    const qty = Math.max(1, Math.min(20, parseInt(item.quantity, 10) || 1));
    return {
      id: crypto.randomUUID(),
      order_id: id,
      product_id: cat.id,
      product_name: cat.name,
      unit_price_paise: cat.pricePaise,
      quantity: qty,
      created_at: now
    };
  });

  const totalPaise = items.reduce((sum, i) => sum + i.unit_price_paise * i.quantity, 0);
  const isPaid = Boolean(data.paymentId);

  const newOrder = {
    id,
    order_ref: orderRef,
    customer_name: String(data.customerName || '').trim(),
    customer_email: data.customerEmail ? String(data.customerEmail).trim().toLowerCase() : null,
    phone: String(data.phone || '').trim(),
    fulfilment: data.fulfilment === 'Delivery' ? 'Delivery' : 'Pickup',
    delivery_address: data.address ? String(data.address).trim() : null,
    notes: data.notes ? String(data.notes).trim() : null,
    payment_method: data.payment || 'UPI payment',
    upi_id: data.upiId || null,
    payment_id: data.paymentId || null,
    status: 'placed',
    payment_status: isPaid ? 'paid' : 'unpaid',
    total_paise: totalPaise,
    items,
    events: [
      {
        status: 'placed',
        note: isPaid ? `Order placed with UPI Payment (UTR: ${data.paymentId})` : 'Order request received',
        created_at: now
      }
    ],
    created_at: now,
    updated_at: now,
    delivered_at: null
  };

  orders.unshift(newOrder);
  writeOrders(orders);
  return newOrder;
}

export function trackOrder(orderRef, phone) {
  const orders = readOrders();
  const ref = String(orderRef || '').trim().toUpperCase();
  const cleanPhone = String(phone || '').trim();
  return orders.find(o => o.order_ref === ref && o.phone === cleanPhone) || null;
}

export function updateOrderStatus(orderRef, newStatus, note) {
  const validStatuses = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(newStatus)) return null;

  const orders = readOrders();
  const ref = String(orderRef || '').trim().toUpperCase();
  const ord = orders.find(o => o.order_ref === ref);
  if (!ord) return null;

  const now = new Date().toISOString();
  ord.status = newStatus;
  ord.updated_at = now;
  if (newStatus === 'delivered' && !ord.delivered_at) {
    ord.delivered_at = now;
  }
  ord.events = ord.events || [];
  ord.events.push({
    status: newStatus,
    note: note || `Status updated to ${newStatus.replaceAll('_', ' ')}`,
    created_at: now
  });

  writeOrders(orders);
  return ord;
}

/**
 * Independent server-side purchase verification.
 * Verifies against actual orders:
 * 1. Customer matches order identity (phone or email on order)
 * 2. Valid order exists
 * 3. Order contains the reviewed product
 * 4. Order reached 'delivered' (completed) status
 */
export function findMatchingDeliveredOrder({ orderRef, customerPhone, customerEmail, productName, productId }) {
  const orders = readOrders();
  const cleanRef = String(orderRef || '').trim().toUpperCase();
  const cleanPhone = String(customerPhone || '').replace(/\D/g, '').slice(-10);
  const cleanEmail = String(customerEmail || '').trim().toLowerCase();
  const targetProdName = normalizeProductName(productName).toLowerCase();
  const targetProdId = String(productId || '').trim().toLowerCase();

  // Need at least one real customer/order identity to verify
  if (!cleanRef && !cleanPhone && !cleanEmail) {
    return { verified: false, reason: 'No order reference or matching customer contact provided.' };
  }

  for (const order of orders) {
    // 1. Order status MUST be completed / delivered
    if (order.status !== 'delivered') continue;

    // 2. Customer identity check against order
    const phoneMatch = Boolean(cleanPhone && order.phone && order.phone === cleanPhone);
    const emailMatch = Boolean(cleanEmail && order.customer_email && order.customer_email.toLowerCase() === cleanEmail);

    if (cleanRef) {
      if (String(order.order_ref || '').toUpperCase() !== cleanRef) continue;
      // When orderRef is provided, require matching phone or email on the order (prevents guessing DEAR-0001)
      if (!phoneMatch && !emailMatch) {
        return { verified: false, reason: 'Order reference found, but customer mobile number/email does not match order.' };
      }
    } else {
      // Without explicit orderRef, match only on verified phone or email
      if (!phoneMatch && !emailMatch) continue;
    }

    // 3. Order MUST contain the exact reviewed product
    const items = Array.isArray(order.items) ? order.items : [];
    const matchedItem = items.find(it => {
      const itName = normalizeProductName(it.product_name).toLowerCase();
      const itId = String(it.product_id || '').toLowerCase();
      return (targetProdId && itId === targetProdId) || (targetProdName && itName === targetProdName);
    });

    if (!matchedItem) {
      if (cleanRef) {
        return { verified: false, reason: 'Order is delivered, but does not contain the reviewed product.' };
      }
      continue;
    }

    return {
      verified: true,
      orderId: order.id,
      orderRef: order.order_ref,
      orderItemId: matchedItem.id,
      productId: matchedItem.product_id,
      deliveredAt: order.delivered_at || order.updated_at,
      matchedBy: cleanRef ? (phoneMatch ? 'order_ref+phone' : 'order_ref+email') : (phoneMatch ? 'phone' : 'email'),
      verifiedAt: new Date().toISOString()
    };
  }

  return {
    verified: false,
    reason: cleanRef
      ? 'No delivered order matching that reference and customer identity was found for this product.'
      : 'No delivered order matching customer contact was found for this product.'
  };
}
