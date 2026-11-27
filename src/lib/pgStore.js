import crypto from 'node:crypto';
import { getPool, withTransaction } from './pgDb.js';
import { normalizeProductName } from './ordersStore.js';
import { detectSuspiciousContent } from './reviewsStore.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_RECOMMENDATIONS = new Set(['Definitely!', 'Maybe', 'Not this time']);
const VALID_DELETE_REASONS = new Set(['duplicate', 'privacy_erasure', 'legal_compliance', 'spam_fraud']);
const VALID_ORDER_STATUSES = new Set(['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']);

const PRODUCT_SLUG_MAP = {
  'Dear Misu Mini': 'mini',
  'Dear Misu Classic': 'classic',
  'Dear Misu Share Box': 'share',
};

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function timingSafeEqualStr(aStr, bStr) {
  if (!aStr || !bStr) return false;
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseOptRating(val) {
  const n = Number(val);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function stripEditToken(row) {
  if (!row) return row;
  const { edit_token_hash, ...safe } = row;
  return safe;
}

function categorySnapshot(src) {
  return {
    taste_rating: src.taste_rating ?? src.tasteRating ?? null,
    creaminess_rating: src.creaminess_rating ?? src.creaminessRating ?? null,
    coffee_intensity_rating: src.coffee_intensity_rating ?? src.coffeeIntensityRating ?? null,
    sweetness_rating: src.sweetness_rating ?? src.sweetnessRating ?? null,
    texture_rating: src.texture_rating ?? src.textureRating ?? null,
    chocolate_rating: src.chocolate_rating ?? src.chocolateRating ?? null,
    presentation_rating: src.presentation_rating ?? src.presentationRating ?? null,
  };
}

async function generateOrderRef(client) {
  const { rows } = await client.query("SELECT nextval('order_seq') AS seq");
  const seq = Number(rows[0].seq);
  return `DEAR-${String(seq).padStart(4, '0')}`;
}

export async function getProductsPg() {
  const { rows } = await getPool().query(
    'SELECT slug, name, price_paise, short_description, badge, image_url FROM products WHERE active = true ORDER BY sort_order'
  );
  return rows.map(row => ({
    id: row.slug,
    name: row.name,
    price: row.price_paise / 100,
    shortDescription: row.short_description,
    badge: row.badge,
    imageUrl: row.image_url,
  }));
}

export async function getNextOrderRefPg() {
  const client = await getPool().connect();
  try {
    return await generateOrderRef(client);
  } finally {
    client.release();
  }
}

export async function createOrderPg(data) {
  return withTransaction(async client => {
    const slugs = (data.items || []).map(item => String(item.productId || '').trim());
    const { rows: products } = await client.query(
      'SELECT id, slug, name, price_paise FROM products WHERE slug = ANY($1::text[]) AND active = true FOR SHARE',
      [slugs]
    );
    if (products.length !== new Set(slugs).size) {
      throw Object.assign(new Error('One or more selected products are not currently available.'), { statusCode: 409 });
    }

    const productMap = new Map(products.map(p => [p.slug, p]));
    const items = (data.items || []).map(item => ({
      product: productMap.get(String(item.productId || '').trim()),
      quantity: Math.max(1, Math.min(20, parseInt(item.quantity, 10) || 1)),
    }));
    const totalPaise = items.reduce((sum, item) => sum + item.product.price_paise * item.quantity, 0);
    const orderRef = (data.orderRef && String(data.orderRef).trim().toUpperCase()) || (await generateOrderRef(client));
    const paymentMethod = data.payment || 'UPI payment';
    const isPaid = Boolean(data.paymentId);
    const paymentStatus = isPaid ? 'paid' : (paymentMethod === 'Pay on pickup / delivery' ? 'unpaid' : 'pending');

    const inserted = await client.query(
      `INSERT INTO orders (order_ref, customer_name, phone, fulfilment, delivery_address, notes, payment_method, upi_id, payment_id, status, payment_status, total_paise)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'placed',$10,$11)
       RETURNING id, order_ref, status, payment_method, total_paise, created_at`,
      [
        orderRef,
        String(data.customerName || '').trim(),
        String(data.phone || '').trim(),
        data.fulfilment === 'Delivery' ? 'Delivery' : 'Pickup',
        data.address ? String(data.address).trim() : null,
        data.notes ? String(data.notes).trim() : null,
        paymentMethod,
        data.upiId || null,
        data.paymentId || null,
        paymentStatus,
        totalPaise,
      ]
    );

    const order = inserted.rows[0];
    await client.query(
      `INSERT INTO order_status_events (order_id, status, note) VALUES ($1, 'placed', $2)`,
      [order.id, isPaid ? `Order placed with UPI Payment (UTR: ${data.paymentId})` : 'Order request received']
    );

    if (isPaid) {
      await client.query(
        `INSERT INTO payments (order_id, gateway, gateway_order_id, amount_paise, currency, status, signature_verified)
         VALUES ($1, 'upi', $2, $3, 'INR', 'paid', true)
         ON CONFLICT (gateway_order_id) DO NOTHING`,
        [order.id, data.paymentId, totalPaise]
      );
    }

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_paise, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.product.id, item.product.name, item.product.price_paise, item.quantity]
      );
    }

    return order;
  });
}

export async function trackOrderPg(orderRef, phone) {
  const pool = getPool();
  const ref = String(orderRef || '').trim().toUpperCase();
  const cleanPhone = String(phone || '').trim();
  const { rows } = await pool.query(
    `SELECT id, order_ref, customer_name, fulfilment, status, payment_method, upi_id, payment_id, payment_status, total_paise, created_at, updated_at
     FROM orders WHERE order_ref = $1 AND phone = $2`,
    [ref, cleanPhone]
  );
  if (!rows.length) return null;

  const order = rows[0];
  const [itemsRes, eventsRes] = await Promise.all([
    pool.query('SELECT product_name, quantity, unit_price_paise FROM order_items WHERE order_id = $1', [order.id]),
    pool.query('SELECT status, note, created_at FROM order_status_events WHERE order_id = $1 ORDER BY created_at ASC', [order.id]),
  ]);

  return {
    order_ref: order.order_ref,
    customer_name: order.customer_name,
    fulfilment: order.fulfilment,
    status: order.status,
    payment_method: order.payment_method,
    payment_id: order.payment_id,
    payment_status: order.payment_status,
    total_paise: order.total_paise,
    items: itemsRes.rows,
    events: eventsRes.rows,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

export async function updateOrderStatusPg(orderRef, newStatus, note) {
  if (!VALID_ORDER_STATUSES.has(newStatus)) return null;
  return withTransaction(async client => {
    const ref = String(orderRef || '').trim().toUpperCase();
    const { rows } = await client.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE order_ref = $2 RETURNING id, order_ref, status',
      [newStatus, ref]
    );
    if (!rows.length) return null;

    await client.query(
      'INSERT INTO order_status_events (order_id, status, note) VALUES ($1, $2, $3)',
      [rows[0].id, newStatus, note || `Status updated to ${newStatus.replaceAll('_', ' ')}`]
    );
    return rows[0];
  });
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
    verifiedAt: new Date().toISOString(),
  };
}

export async function getPublicReviewsPg({ page = 1, limit = 10, product, rating, verification, sort = 'chronological' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (p - 1) * l;

  const conditions = ["status = 'APPROVED'"];
  const params = [];
  let idx = 1;

  if (product) {
    conditions.push(`product_name = $${idx++}`);
    params.push(normalizeProductName(product));
  }
  if (rating) {
    conditions.push(`overall_rating = $${idx++}`);
    params.push(parseInt(rating, 10));
  }
  if (verification === 'VERIFIED_PURCHASE' || verification === 'verified') {
    conditions.push("purchase_verification_status = 'VERIFIED_PURCHASE'");
  } else if (verification === 'UNVERIFIED' || verification === 'unverified') {
    conditions.push("purchase_verification_status <> 'VERIFIED_PURCHASE'");
  }

  const sortMap = {
    chronological: 'created_at DESC',
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    highest: 'overall_rating DESC, created_at DESC',
    lowest: 'overall_rating ASC, created_at DESC',
    helpful: 'helpful_count DESC, created_at DESC',
  };
  const orderBy = sortMap[sort] || sortMap.chronological;
  const where = conditions.join(' AND ');
  const pool = getPool();

  const [countResult, rowsResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM customer_reviews WHERE ${where}`, params),
    pool.query(
      `SELECT id, product_id, customer_name, product_name, overall_rating,
              taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
              texture_rating, chocolate_rating, presentation_rating,
              sweetness_preference, coffee_preference, texture_preference,
              feedback_tags, comment, recommendation, status,
              verified_purchase, purchase_verification_status, customer_edited,
              helpful_count, created_at, updated_at, published_at, moderated_at
       FROM customer_reviews WHERE ${where}
       ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, l, offset]
    ),
  ]);

  const total = countResult.rows[0]?.count || 0;
  const rows = rowsResult.rows;
  const reviews = sort === 'chronological' || !sortMap[sort]
    ? [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    : rows;

  return { reviews, total, page: p, totalPages: Math.ceil(total / l) || 1 };
}

export async function getPublicStatsPg() {
  const pool = getPool();
  const [summaryRes, productAvgRes] = await Promise.all([
    pool.query(
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
    ),
    pool.query(
      `SELECT product_name, ROUND(AVG(overall_rating), 2) AS avg_rating, COUNT(*)::int AS total
       FROM customer_reviews WHERE status = 'APPROVED' GROUP BY product_name`
    ),
  ]);

  const s = summaryRes.rows[0];
  const total = s.total || 0;
  const pct = n => (total ? Math.round((n / total) * 100) : 0);
  const recPct = s.rec_responses > 0 ? Math.round((s.recommend_yes / s.rec_responses) * 100) : null;

  return {
    averageRating: parseFloat(s.avg_rating),
    totalReviews: total,
    verifiedPurchaseCount: s.verified_count || 0,
    distribution: {
      5: { count: s.stars_5, percentage: pct(s.stars_5) },
      4: { count: s.stars_4, percentage: pct(s.stars_4) },
      3: { count: s.stars_3, percentage: pct(s.stars_3) },
      2: { count: s.stars_2, percentage: pct(s.stars_2) },
      1: { count: s.stars_1, percentage: pct(s.stars_1) },
    },
    recommendationPercentage: recPct,
    recommendationResponseCount: s.rec_responses || 0,
    productAverages: productAvgRes.rows.map(r => ({
      product_name: r.product_name,
      avg_rating: parseFloat(r.avg_rating),
      total: r.total,
    })),
  };
}

export async function createReviewPg(data) {
  const productName = normalizeProductName(data.productName);
  const productId = PRODUCT_SLUG_MAP[productName] || null;
  const cleanName = String(data.customerName || '').trim();
  const cleanEmail = data.customerEmail ? String(data.customerEmail).trim().toLowerCase() : null;
  const cleanPhoneRaw = data.customerPhone ? String(data.customerPhone).replace(/\D/g, '').slice(-10) : null;
  const cleanPhone = cleanPhoneRaw && /^[6-9]\d{9}$/.test(cleanPhoneRaw) ? cleanPhoneRaw : null;
  const cleanOrderRef = data.orderRef ? String(data.orderRef).trim().toUpperCase() : null;
  const cleanComment = String(data.comment || '').trim();
  const customerId = cleanPhone || cleanEmail || null;
  const editToken = crypto.randomBytes(24).toString('hex');
  const suspiciousReason = detectSuspiciousContent(cleanComment);
  const feedbackTags = Array.isArray(data.feedbackTags) ? data.feedbackTags.slice(0, 10) : [];
  const recommendation = VALID_RECOMMENDATIONS.has(data.recommendation) ? data.recommendation : null;
  const ratings = {
    tasteRating: parseOptRating(data.tasteRating),
    creaminessRating: parseOptRating(data.creaminessRating),
    coffeeIntensityRating: parseOptRating(data.coffeeIntensityRating),
    sweetnessRating: parseOptRating(data.sweetnessRating),
    textureRating: parseOptRating(data.textureRating),
    chocolateRating: parseOptRating(data.chocolateRating),
    presentationRating: parseOptRating(data.presentationRating),
  };

  return withTransaction(async client => {
    const verification = await verifyPurchasePg(client, {
      orderRef: cleanOrderRef,
      customerPhone: cleanPhone,
      productName,
    });

    if (verification.verified) {
      const dupOrder = await client.query(
        'SELECT id FROM customer_reviews WHERE order_id = $1 AND product_name = $2 LIMIT 1',
        [verification.orderId, productName]
      );
      if (dupOrder.rows.length) {
        return {
          error: 'A review has already been submitted for this product on this order. You can edit your existing review instead.',
          code: 'DUPLICATE_ORDER_REVIEW',
          existingReviewId: dupOrder.rows[0].id,
        };
      }
    }

    const dupContent = await client.query(
      `SELECT id FROM customer_reviews
       WHERE product_name = $1
         AND (
           ($2::text IS NOT NULL AND customer_phone = $2)
           OR ($3::text IS NOT NULL AND LOWER(customer_email) = $3)
           OR LOWER(customer_name) = LOWER($4)
         )
         AND (
           ($5::text IS NOT NULL AND order_ref = $5)
           OR LOWER(comment) = LOWER($6)
         )
       LIMIT 1`,
      [productName, cleanPhone, cleanEmail, cleanName, cleanOrderRef, cleanComment]
    );
    if (dupContent.rows.length) {
      return {
        error: 'A duplicate review for this product has already been recorded.',
        code: 'DUPLICATE_REVIEW',
        existingReviewId: dupContent.rows[0].id,
      };
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
       RETURNING id, product_id, customer_name, product_name, overall_rating,
                 taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
                 texture_rating, chocolate_rating, presentation_rating,
                 sweetness_preference, coffee_preference, texture_preference,
                 feedback_tags, comment, recommendation, status, verified_purchase,
                 purchase_verification_status, customer_edited, helpful_count, created_at, updated_at`,
      [
        customerId, productId,
        verification.verified ? verification.orderId : null,
        verification.verified ? verification.orderRef : cleanOrderRef,
        verification.verified ? verification.orderItemId : null,
        cleanName, cleanEmail, cleanPhone, productName, Number(data.overallRating),
        ratings.tasteRating, ratings.creaminessRating, ratings.coffeeIntensityRating, ratings.sweetnessRating,
        ratings.textureRating, ratings.chocolateRating, ratings.presentationRating,
        data.sweetnessPreference || null, data.coffeePreference || null, data.texturePreference || null,
        feedbackTags, cleanComment, recommendation,
        Boolean(verification.verified), verStatus, evidence,
        Boolean(suspiciousReason), suspiciousReason, hashToken(editToken),
      ]
    );

    const review = rows[0];
    await client.query(
      `INSERT INTO review_versions (review_id, version_number, overall_rating, comment, category_ratings, recommendation, edited_by)
       VALUES ($1, 1, $2, $3, $4, $5, $6)`,
      [review.id, review.overall_rating, cleanComment, JSON.stringify(categorySnapshot(review)), recommendation, cleanName]
    );
    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, new_status, metadata)
       VALUES ($1, 'customer', $2, 'SUBMITTED', 'PENDING', $3)`,
      [
        review.id,
        customerId || cleanName,
        JSON.stringify({
          verificationStatus: verStatus,
          verificationReason: verification.verified ? verification.matchedBy : verification.reason,
        }),
      ]
    );
    if (suspiciousReason) {
      await client.query(
        `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason)
         VALUES ($1, 'system', 'integrity-check', 'FLAGGED', 'PENDING', 'PENDING', $2)`,
        [review.id, suspiciousReason]
      );
    }

    return {
      review,
      verificationStatus: verStatus,
      verificationReason: verification.verified ? 'Matched to a completed delivered order.' : verification.reason,
      editToken,
    };
  });
}

export async function getReviewForCustomerEditPg(id, editToken) {
  if (!UUID_RE.test(String(id || '')) || !editToken) return null;
  const { rows } = await getPool().query(
    `SELECT id, product_id, customer_name, product_name, overall_rating,
            taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
            texture_rating, chocolate_rating, presentation_rating,
            sweetness_preference, coffee_preference, texture_preference,
            feedback_tags, comment, recommendation, status,
            verified_purchase, purchase_verification_status, customer_edited,
            helpful_count, created_at, updated_at, edit_token_hash
     FROM customer_reviews WHERE id = $1`,
    [id]
  );
  if (!rows.length || !timingSafeEqualStr(hashToken(editToken), rows[0].edit_token_hash)) {
    return null;
  }
  return stripEditToken(rows[0]);
}

export async function updateCustomerReviewPg(id, editToken, updates) {
  if (!id || !editToken) {
    return { error: 'Authorization token required to edit review.', statusCode: 401 };
  }
  if (!UUID_RE.test(String(id))) {
    return { error: 'Review not found or customer editing is not available for this record.', statusCode: 404 };
  }

  return withTransaction(async client => {
    const { rows } = await client.query('SELECT * FROM customer_reviews WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length || !rows[0].edit_token_hash) {
      return { error: 'Review not found or customer editing is not available for this record.', statusCode: 404 };
    }
    const existing = rows[0];
    if (!timingSafeEqualStr(hashToken(editToken), existing.edit_token_hash)) {
      return { error: 'Invalid review edit token.', statusCode: 403 };
    }

    const nextName = updates.customerName && String(updates.customerName).replace(/<[^>]*>/g, '').trim().length >= 2
      ? String(updates.customerName).replace(/<[^>]*>/g, '').trim().slice(0, 80)
      : existing.customer_name;

    let nextRating = existing.overall_rating;
    if (updates.overallRating !== undefined) {
      const r = Number(updates.overallRating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return { error: 'Overall rating must be between 1 and 5.', statusCode: 400 };
      }
      nextRating = r;
    }

    let nextComment = existing.comment;
    if (updates.comment !== undefined) {
      const clean = String(updates.comment).replace(/<[^>]*>/g, '').trim();
      if (clean.length < 10 || clean.length > 1000) {
        return { error: 'Review text must be between 10 and 1000 characters.', statusCode: 400 };
      }
      nextComment = clean;
    }

    const optField = (inKey, dbKey) => {
      if (updates[inKey] === undefined) return existing[dbKey];
      return updates[inKey] ? parseOptRating(updates[inKey]) : null;
    };

    const nextCat = {
      taste_rating: optField('tasteRating', 'taste_rating'),
      creaminess_rating: optField('creaminessRating', 'creaminess_rating'),
      coffee_intensity_rating: optField('coffeeIntensityRating', 'coffee_intensity_rating'),
      sweetness_rating: optField('sweetnessRating', 'sweetness_rating'),
      texture_rating: optField('textureRating', 'texture_rating'),
      chocolate_rating: optField('chocolateRating', 'chocolate_rating'),
      presentation_rating: optField('presentationRating', 'presentation_rating'),
    };
    const nextRecommendation = updates.recommendation !== undefined
      ? (VALID_RECOMMENDATIONS.has(updates.recommendation) ? updates.recommendation : null)
      : existing.recommendation;
    const nextTags = Array.isArray(updates.feedbackTags)
      ? updates.feedbackTags.map(t => String(t).replace(/<[^>]*>/g, '').trim()).filter(Boolean).slice(0, 10)
      : existing.feedback_tags;
    const suspiciousReason = detectSuspiciousContent(nextComment);

    const { rows: updated } = await client.query(
      `UPDATE customer_reviews
       SET customer_name = $2,
           overall_rating = $3,
           comment = $4,
           recommendation = $5,
           taste_rating = $6,
           creaminess_rating = $7,
           coffee_intensity_rating = $8,
           sweetness_rating = $9,
           texture_rating = $10,
           chocolate_rating = $11,
           presentation_rating = $12,
           sweetness_preference = $13,
           coffee_preference = $14,
           texture_preference = $15,
           feedback_tags = $16,
           flagged_for_review = $17,
           flag_reason = $18,
           customer_edited = true,
           status = 'PENDING',
           updated_at = now()
       WHERE id = $1
       RETURNING id, product_id, customer_name, product_name, overall_rating,
                 taste_rating, creaminess_rating, coffee_intensity_rating, sweetness_rating,
                 texture_rating, chocolate_rating, presentation_rating,
                 sweetness_preference, coffee_preference, texture_preference,
                 feedback_tags, comment, recommendation, status, verified_purchase,
                 purchase_verification_status, customer_edited, helpful_count, created_at, updated_at`,
      [
        id, nextName, nextRating, nextComment, nextRecommendation,
        nextCat.taste_rating, nextCat.creaminess_rating, nextCat.coffee_intensity_rating, nextCat.sweetness_rating,
        nextCat.texture_rating, nextCat.chocolate_rating, nextCat.presentation_rating,
        updates.sweetnessPreference !== undefined ? (updates.sweetnessPreference || null) : existing.sweetness_preference,
        updates.coffeePreference !== undefined ? (updates.coffeePreference || null) : existing.coffee_preference,
        updates.texturePreference !== undefined ? (updates.texturePreference || null) : existing.texture_preference,
        nextTags, Boolean(suspiciousReason), suspiciousReason,
      ]
    );

    const verRes = await client.query('SELECT COALESCE(MAX(version_number), 0)::int AS max_v FROM review_versions WHERE review_id = $1', [id]);
    await client.query(
      `INSERT INTO review_versions (review_id, version_number, overall_rating, comment, category_ratings, recommendation, edited_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, verRes.rows[0].max_v + 1, nextRating, nextComment, JSON.stringify(nextCat), nextRecommendation, nextName]
    );
    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason)
       VALUES ($1, 'customer', $2, 'CUSTOMER_EDITED', $3, 'PENDING', 'Customer updated their own review; queued for re-moderation.')`,
      [id, existing.customer_id || nextName, existing.status]
    );

    return { review: updated[0] };
  });
}

export async function upvoteReviewHelpfulPg(reviewId, voterHash) {
  if (!UUID_RE.test(String(reviewId || '')) || !voterHash) {
    return { voted: false, notFound: true };
  }
  const pool = getPool();
  const pubCheck = await pool.query(
    "SELECT id, helpful_count FROM customer_reviews WHERE id = $1 AND status = 'APPROVED'",
    [reviewId]
  );
  if (!pubCheck.rows.length) return { voted: false, notFound: true };

  const { rowCount } = await pool.query(
    `INSERT INTO review_helpful_votes (review_id, voter_ip_hash)
     VALUES ($1, $2) ON CONFLICT (review_id, voter_ip_hash) DO NOTHING`,
    [reviewId, voterHash]
  );

  if (rowCount > 0) {
    const upd = await pool.query(
      'UPDATE customer_reviews SET helpful_count = helpful_count + 1 WHERE id = $1 RETURNING helpful_count',
      [reviewId]
    );
    return { voted: true, helpfulCount: upd.rows[0].helpful_count };
  }

  return { voted: false, duplicate: true, helpfulCount: pubCheck.rows[0].helpful_count };
}

export async function getAdminStatsPg() {
  const { rows } = await getPool().query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
       COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
       COUNT(*) FILTER (WHERE status = 'HIDDEN')::int AS hidden,
       COUNT(*) FILTER (WHERE purchase_verification_status = 'VERIFIED_PURCHASE')::int AS verified_count,
       COUNT(*) FILTER (WHERE flagged_for_review = true)::int AS flagged_count,
       COALESCE(ROUND(AVG(overall_rating) FILTER (WHERE status = 'APPROVED'), 2), 0) AS avg_rating,
       COUNT(*) FILTER (WHERE status = 'APPROVED' AND recommendation IN ('Definitely!','Maybe','Not this time'))::int AS approved_rec_responses,
       COUNT(*) FILTER (WHERE status = 'APPROVED' AND recommendation = 'Definitely!')::int AS approved_rec_yes,
       COUNT(*) FILTER (WHERE recommendation IN ('Definitely!','Maybe','Not this time'))::int AS all_rec_responses,
       COUNT(*) FILTER (WHERE recommendation = 'Definitely!')::int AS all_rec_yes
     FROM customer_reviews`
  );
  const s = rows[0];
  const total = s.total || 0;
  const recResponses = s.approved > 0 ? s.approved_rec_responses : s.all_rec_responses;
  const recYes = s.approved > 0 ? s.approved_rec_yes : s.all_rec_yes;
  const recPct = recResponses > 0 ? Math.round((recYes / recResponses) * 100) : null;

  return {
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
    recommendationResponseCount: recResponses || 0,
  };
}

export async function getAdminReviewsPg({ page = 1, limit = 15, status, product, rating, verification, flagged, search, sort = 'newest' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 15));
  const offset = (p - 1) * l;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (status && status !== 'ALL') {
    if (status === 'REJECTED_OR_HIDDEN') {
      conditions.push("status IN ('REJECTED', 'HIDDEN')");
    } else {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
  }
  if (product) {
    conditions.push(`product_name = $${idx++}`);
    params.push(normalizeProductName(product));
  }
  if (rating) {
    conditions.push(`overall_rating = $${idx++}`);
    params.push(parseInt(rating, 10));
  }
  if (verification === 'VERIFIED_PURCHASE' || verification === 'UNVERIFIED') {
    conditions.push(`purchase_verification_status = $${idx++}`);
    params.push(verification);
  }
  if (flagged === 'true' || flagged === true) {
    conditions.push('flagged_for_review = true');
  }
  if (search) {
    conditions.push(
      `(customer_name ILIKE $${idx} OR customer_email ILIKE $${idx} OR comment ILIKE $${idx} OR product_name ILIKE $${idx} OR order_ref ILIKE $${idx})`
    );
    params.push(`%${String(search).trim()}%`);
    idx++;
  }

  const sortMap = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    highest: 'overall_rating DESC, created_at DESC',
    lowest: 'overall_rating ASC, created_at DESC',
    helpful: 'helpful_count DESC, created_at DESC',
  };
  const orderBy = sortMap[sort] || sortMap.newest;
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();

  const [countRes, rowsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM customer_reviews ${where}`, params),
    pool.query(
      `SELECT * FROM customer_reviews ${where} ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, l, offset]
    ),
  ]);

  const total = countRes.rows[0]?.count || 0;
  return {
    reviews: rowsRes.rows.map(stripEditToken),
    total,
    page: p,
    totalPages: Math.ceil(total / l) || 1,
  };
}

export async function getAdminReviewDetailsPg(id) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const pool = getPool();
  const rev = await pool.query('SELECT * FROM customer_reviews WHERE id = $1', [id]);
  if (!rev.rows.length) return null;

  const [logs, versions] = await Promise.all([
    pool.query('SELECT * FROM review_audit_logs WHERE review_id = $1 ORDER BY created_at DESC', [id]),
    pool.query('SELECT * FROM review_versions WHERE review_id = $1 ORDER BY version_number DESC', [id]),
  ]);

  return {
    review: stripEditToken(rev.rows[0]),
    auditLogs: logs.rows,
    versions: versions.rows,
  };
}

export async function getAuditLogsForAdminPg(limit = 100) {
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
  const { rows } = await getPool().query(
    'SELECT * FROM review_audit_logs ORDER BY created_at DESC LIMIT $1',
    [safeLimit]
  );
  return rows;
}

export async function moderateReviewPg({ id, action, adminId = 'Store Admin', reason = '' }) {
  if (!UUID_RE.test(String(id || ''))) {
    return { error: 'Review not found.', statusCode: 404 };
  }

  const cleanReason = String(reason || '').trim();
  const actionConfig = {
    APPROVE: { targetStatus: 'APPROVED', auditAction: 'APPROVED', requireReason: false },
    REJECT: { targetStatus: 'REJECTED', auditAction: 'REJECTED', requireReason: true },
    HIDE: { targetStatus: 'HIDDEN', auditAction: 'HIDDEN', requireReason: true, allowedPrev: ['APPROVED'] },
    RESTORE: { targetStatus: 'APPROVED', auditAction: 'RESTORED', requireReason: false, allowedPrev: ['HIDDEN', 'REJECTED'] },
  }[action];

  if (!actionConfig) return { error: 'Invalid moderation action.', statusCode: 400 };
  if (actionConfig.requireReason && cleanReason.length < 3) {
    return { error: `An internal moderation reason is required to ${action.toLowerCase()} a review.`, statusCode: 400 };
  }

  return withTransaction(async client => {
    const cur = await client.query('SELECT * FROM customer_reviews WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows.length) return { error: 'Review not found.', statusCode: 404 };
    const prevStatus = cur.rows[0].status;
    if (actionConfig.allowedPrev && !actionConfig.allowedPrev.includes(prevStatus)) {
      return { error: `Cannot ${action.toLowerCase()} a review in ${prevStatus} state.`, statusCode: 400 };
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
      [id, actionConfig.targetStatus, cleanReason, adminId]
    );

    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6)`,
      [id, adminId, actionConfig.auditAction, prevStatus, actionConfig.targetStatus, cleanReason || null]
    );

    return { review: stripEditToken(rows[0]) };
  });
}

export async function deleteReviewPg(id, { adminId = 'Store Admin', reasonCategory, reason } = {}) {
  const cleanCategory = String(reasonCategory || '').trim();
  const cleanReason = String(reason || '').trim();

  if (!VALID_DELETE_REASONS.has(cleanCategory)) {
    return {
      error: 'Permanent deletion requires a legitimate reason category (duplicate, privacy_erasure, legal_compliance, or spam_fraud). Negative reviews cannot be deleted simply for being negative.',
      statusCode: 400,
    };
  }
  if (cleanReason.length < 5) {
    return {
      error: 'Please provide a specific internal explanation (at least 5 characters) for deleting this record.',
      statusCode: 400,
    };
  }
  if (!UUID_RE.test(String(id || ''))) {
    return { error: 'Review not found.', statusCode: 404 };
  }

  return withTransaction(async client => {
    const cur = await client.query('SELECT * FROM customer_reviews WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows.length) return { error: 'Review not found.', statusCode: 404 };
    const target = cur.rows[0];

    if (target.overall_rating <= 2 && target.purchase_verification_status === 'VERIFIED_PURCHASE' && cleanCategory === 'spam_fraud') {
      return {
        error: 'Verified-purchase negative feedback cannot be permanently deleted as spam. Use Hide with an internal reason if there is a policy violation.',
        statusCode: 403,
      };
    }

    await client.query(
      `INSERT INTO review_audit_logs (review_id, actor_type, actor_id, action, previous_status, new_status, reason, metadata)
       VALUES ($1, 'admin', $2, 'DELETED', $3, 'DELETED', $4, $5)`,
      [
        id,
        adminId,
        target.status,
        `[${cleanCategory}] ${cleanReason}`,
        JSON.stringify({
          productName: target.product_name,
          overallRating: target.overall_rating,
          verificationStatus: target.purchase_verification_status,
        }),
      ]
    );
    await client.query('DELETE FROM customer_reviews WHERE id = $1', [id]);
    return { deleted: true };
  });
}
