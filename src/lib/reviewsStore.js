import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { findMatchingDeliveredOrder, normalizeProductName } from './ordersStore.js';

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_DIR = path.join(process.cwd(), 'data');
const BUNDLED_FILE = path.join(BUNDLED_DIR, 'reviews.json');
const DATA_DIR = IS_SERVERLESS ? path.join('/tmp', 'tiramio-data') : BUNDLED_DIR;
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const AUDIT_FILE = path.join(DATA_DIR, 'review_audit_logs.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'review_versions.json');
const VOTES_FILE = path.join(DATA_DIR, 'review_helpful_votes.json');

const PRODUCT_SLUG_MAP = {
  'Dear Misu Mini': 'mini',
  'Dear Misu Classic': 'classic',
  'Dear Misu Share Box': 'share',
};

const VALID_DELETE_REASONS = new Set(['duplicate', 'privacy_erasure', 'legal_compliance', 'spam_fraud']);
const VALID_RECOMMENDATIONS = new Set(['Definitely!', 'Maybe', 'Not this time']);

const INITIAL_REVIEWS = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    customer_id: null,
    product_id: 'classic',
    customer_name: 'Ananya Sharma',
    customer_email: null,
    customer_phone: null,
    product_name: 'Dear Misu Classic',
    order_id: null,
    order_ref: null,
    order_item_id: null,
    overall_rating: 5,
    taste_rating: 5,
    creaminess_rating: 5,
    coffee_intensity_rating: 4,
    sweetness_rating: 5,
    texture_rating: 5,
    chocolate_rating: 5,
    presentation_rating: 5,
    sweetness_preference: 'Just right',
    coffee_preference: 'Balanced',
    texture_preference: 'Extra creamy',
    feedback_tags: ['Perfectly creamy', 'Rich coffee flavour', 'Loved the chocolate finish', 'Worth every spoonful'],
    comment: 'The mascarpone cream is delightfully silky, perfectly balancing the espresso soak. Every spoonful felt heavenly!',
    recommendation: 'Definitely!',
    status: 'APPROVED',
    verified_purchase: false,
    purchase_verification_status: 'UNVERIFIED',
    verification_evidence: null,
    flagged_for_review: true,
    flag_reason: 'Initial sample review (no linked delivered order)',
    moderation_reason: null,
    helpful_count: 14,
    created_at: '2026-11-15T14:29:18.899Z',
    updated_at: '2026-11-15T14:29:18.899Z',
    published_at: '2026-11-16T14:29:18.899Z',
    moderated_at: '2026-11-16T14:29:18.899Z',
    moderated_by: 'Store Admin'
  },
  {
    id: 'e1d2c3b4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
    customer_id: null,
    product_id: 'mini',
    customer_name: 'Priya Iyer',
    customer_email: null,
    customer_phone: null,
    product_name: 'Dear Misu Mini',
    order_id: null,
    order_ref: null,
    order_item_id: null,
    overall_rating: 5,
    taste_rating: 5,
    creaminess_rating: 5,
    coffee_intensity_rating: 4,
    sweetness_rating: 5,
    texture_rating: 5,
    chocolate_rating: 4,
    presentation_rating: 5,
    sweetness_preference: 'Just right',
    coffee_preference: 'Balanced',
    texture_preference: 'Soft and fluffy',
    feedback_tags: ['Soft and fluffy layers', 'Beautiful presentation', 'Worth every spoonful'],
    comment: 'The Mini is just the right portion for my evening sweet craving. Delicate, authentic Italian taste in Bangalore!',
    recommendation: 'Definitely!',
    status: 'APPROVED',
    verified_purchase: false,
    purchase_verification_status: 'UNVERIFIED',
    verification_evidence: null,
    flagged_for_review: true,
    flag_reason: 'Initial sample review (no linked delivered order)',
    moderation_reason: null,
    helpful_count: 3,
    created_at: '2026-11-18T08:29:18.899Z',
    updated_at: '2026-11-18T08:29:18.899Z',
    published_at: '2026-11-19T13:32:22.288Z',
    moderated_at: '2026-11-19T13:32:22.288Z',
    moderated_by: 'Store Admin'
  }
];

let inMemoryReviews = null;
let lastWriteWasMemoryOnly = false;
let inMemoryAuditLogs = null;
let inMemoryVersions = null;
let inMemoryVotes = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonArray(filePath, bundledFallback, memoryRef, fallbackDefault = []) {
  if (lastWriteWasMemoryOnly && Array.isArray(memoryRef)) {
    return memoryRef;
  }
  try {
    ensureDir();
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
    if (bundledFallback && fs.existsSync(bundledFallback)) {
      const seed = JSON.parse(fs.readFileSync(bundledFallback, 'utf-8'));
      if (Array.isArray(seed)) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(seed, null, 2), 'utf-8');
        } catch { /* ignore */ }
        return seed;
      }
    }
  } catch (err) {
    console.warn(`Store read notice (${path.basename(filePath)}):`, err.message);
  }
  return Array.isArray(memoryRef) ? memoryRef : [...fallbackDefault];
}

function writeJsonArray(filePath, data) {
  try {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    lastWriteWasMemoryOnly = false;
    return true;
  } catch (err) {
    lastWriteWasMemoryOnly = true;
    console.warn(`Store write notice (${path.basename(filePath)}):`, err.message);
    return true;
  }
}

function normalizeReview(r) {
  const productName = normalizeProductName(r.product_name);
  const hasRealEvidence = Boolean(r.verification_evidence && r.verification_evidence.orderId);
  const verificationStatus = r.purchase_verification_status === 'VERIFIED_PURCHASE' && hasRealEvidence
    ? 'VERIFIED_PURCHASE'
    : 'UNVERIFIED';
  const verifiedPurchase = verificationStatus === 'VERIFIED_PURCHASE';

  return {
    ...r,
    customer_id: r.customer_id || null,
    product_id: r.product_id || PRODUCT_SLUG_MAP[productName] || null,
    product_name: productName,
    order_id: r.order_id || null,
    order_ref: r.order_ref || null,
    order_item_id: r.order_item_id || null,
    customer_phone: r.customer_phone || null,
    purchase_verification_status: verificationStatus,
    verified_purchase: verifiedPurchase,
    verification_evidence: hasRealEvidence ? r.verification_evidence : null,
    flagged_for_review: Boolean(r.flagged_for_review),
    flag_reason: r.flag_reason || null,
    moderation_reason: r.moderation_reason || null,
    customer_edited: Boolean(r.customer_edited),
    edit_token_hash: r.edit_token_hash || null,
    published_at: r.published_at || (r.status === 'APPROVED' ? (r.moderated_at || r.created_at) : null),
  };
}

function readReviews() {
  const raw = readJsonArray(REVIEWS_FILE, BUNDLED_FILE, inMemoryReviews, INITIAL_REVIEWS);
  inMemoryReviews = raw.map(normalizeReview);
  return inMemoryReviews;
}

function writeReviews(reviews) {
  const normalized = reviews.map(normalizeReview);
  inMemoryReviews = normalized;
  return writeJsonArray(REVIEWS_FILE, normalized);
}

function readAuditLogs() {
  inMemoryAuditLogs = readJsonArray(AUDIT_FILE, null, inMemoryAuditLogs, []);
  return inMemoryAuditLogs;
}

function appendAuditLog({ reviewId, actorType = 'admin', actorId = 'admin', action, previousStatus = null, newStatus = null, reason = null, metadata = null }) {
  const logs = readAuditLogs();
  const entry = {
    id: crypto.randomUUID(),
    review_id: reviewId,
    actor_type: actorType,
    actor_id: actorId,
    action,
    previous_status: previousStatus,
    new_status: newStatus,
    reason: reason ? String(reason).trim() : null,
    metadata: metadata || null,
    created_at: new Date().toISOString()
  };
  logs.unshift(entry);
  inMemoryAuditLogs = logs;
  writeJsonArray(AUDIT_FILE, logs);
  return entry;
}

function readVersions() {
  inMemoryVersions = readJsonArray(VERSIONS_FILE, null, inMemoryVersions, []);
  return inMemoryVersions;
}

function appendVersion(review, editedBy = 'customer') {
  const versions = readVersions();
  const existingForReview = versions.filter(v => v.review_id === review.id);
  const nextVersionNumber = existingForReview.length + 1;
  const entry = {
    id: crypto.randomUUID(),
    review_id: review.id,
    version_number: nextVersionNumber,
    overall_rating: review.overall_rating,
    comment: review.comment,
    category_ratings: {
      taste_rating: review.taste_rating || null,
      creaminess_rating: review.creaminess_rating || null,
      coffee_intensity_rating: review.coffee_intensity_rating || null,
      sweetness_rating: review.sweetness_rating || null,
      texture_rating: review.texture_rating || null,
      chocolate_rating: review.chocolate_rating || null,
      presentation_rating: review.presentation_rating || null,
    },
    recommendation: review.recommendation || null,
    edited_by: editedBy,
    created_at: new Date().toISOString()
  };
  versions.unshift(entry);
  inMemoryVersions = versions;
  writeJsonArray(VERSIONS_FILE, versions);
  return entry;
}

function readVotes() {
  inMemoryVotes = readJsonArray(VOTES_FILE, null, inMemoryVotes, []);
  return inMemoryVotes;
}

function writeVotes(votes) {
  inMemoryVotes = votes;
  return writeJsonArray(VOTES_FILE, votes);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function detectSuspiciousContent(comment) {
  const text = String(comment || '').trim();
  if (!text) return 'Empty review comment';
  // Keyboard mash / excessive consonant cluster / repetitive characters
  if (/(.)\1{5,}/i.test(text)) return 'Suspicious repetitive character sequence';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1 && text.length >= 10 && !/[aeiou]/i.test(text)) {
    return 'Suspicious non-word placeholder text';
  }
  if (words.length <= 2 && /[bcdfghjklmnpqrstvwxyz]{6,}/i.test(text)) {
    return 'Suspicious consonant-mash placeholder text';
  }
  return null;
}

function sanitizePublicReview(r) {
  // Never reveal personal information or internal verification/moderation evidence publicly
  const {
    customer_email,
    customer_phone,
    customer_id,
    order_id,
    order_ref,
    order_item_id,
    verification_evidence,
    edit_token_hash,
    moderation_reason,
    flag_reason,
    flagged_for_review,
    moderated_by,
    customer_image_url,
    ...safe
  } = r;
  return safe;
}

function sanitizeAdminReview(r) {
  const { edit_token_hash, customer_image_url, ...safe } = r;
  return safe;
}

export function getPublicReviews({ page = 1, limit = 10, product, rating, verification, sort = 'chronological' } = {}) {
  const all = readReviews();
  let list = all.filter(r => r.status === 'APPROVED');

  if (product) list = list.filter(r => r.product_name === normalizeProductName(product));
  if (rating) list = list.filter(r => r.overall_rating === parseInt(rating, 10));
  if (verification === 'VERIFIED_PURCHASE' || verification === 'verified') {
    list = list.filter(r => r.purchase_verification_status === 'VERIFIED_PURCHASE');
  } else if (verification === 'UNVERIFIED' || verification === 'unverified') {
    list = list.filter(r => r.purchase_verification_status !== 'VERIFIED_PURCHASE');
  }

  const total = list.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
  const offset = (p - 1) * l;

  let selected;
  if (sort === 'chronological' || sort === 'queue' || !['newest', 'oldest', 'highest', 'lowest', 'helpful'].includes(sort)) {
    // 1. Pick the latest published reviews up to limit (never prioritizing positive over negative)
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // 2. Display left-to-right in ascending date order (earliest -> latest) so
    //    earlier reviews approved later slot automatically between existing dates.
    selected = list
      .slice(offset, offset + l)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else {
    list.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'highest') return b.overall_rating - a.overall_rating || new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'lowest') return a.overall_rating - b.overall_rating || new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'helpful') return (b.helpful_count || 0) - (a.helpful_count || 0) || new Date(b.created_at) - new Date(a.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
    selected = list.slice(offset, offset + l);
  }

  const paginated = selected.map(sanitizePublicReview);

  return { reviews: paginated, total, page: p, totalPages: Math.ceil(total / l) || 1 };
}

export function getPublicStats() {
  const all = readReviews();
  const approved = all.filter(r => r.status === 'APPROVED');
  const total = approved.length;

  if (total === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      verifiedPurchaseCount: 0,
      distribution: {
        5: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        1: { count: 0, percentage: 0 }
      },
      recommendationPercentage: null,
      recommendationResponseCount: 0,
      productAverages: []
    };
  }

  const sumRatings = approved.reduce((acc, r) => acc + (r.overall_rating || 0), 0);
  const avg = parseFloat((sumRatings / total).toFixed(2));
  const verifiedPurchaseCount = approved.filter(r => r.purchase_verification_status === 'VERIFIED_PURCHASE').length;

  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  approved.forEach(r => {
    const star = Math.min(5, Math.max(1, Math.round(r.overall_rating)));
    dist[star] = (dist[star] || 0) + 1;
  });

  const pct = n => Math.round((n / total) * 100);
  const recResponses = approved.filter(r => VALID_RECOMMENDATIONS.has(r.recommendation));
  const recommendYes = recResponses.filter(r => r.recommendation === 'Definitely!').length;
  const recommendationPercentage = recResponses.length > 0
    ? Math.round((recommendYes / recResponses.length) * 100)
    : null;

  const prodGroups = {};
  approved.forEach(r => {
    if (!prodGroups[r.product_name]) prodGroups[r.product_name] = { sum: 0, count: 0 };
    prodGroups[r.product_name].sum += r.overall_rating;
    prodGroups[r.product_name].count += 1;
  });
  const productAverages = Object.entries(prodGroups).map(([name, g]) => ({
    product_name: name,
    avg_rating: parseFloat((g.sum / g.count).toFixed(2)),
    total: g.count
  }));

  return {
    averageRating: avg,
    totalReviews: total,
    verifiedPurchaseCount,
    distribution: {
      5: { count: dist[5], percentage: pct(dist[5]) },
      4: { count: dist[4], percentage: pct(dist[4]) },
      3: { count: dist[3], percentage: pct(dist[3]) },
      2: { count: dist[2], percentage: pct(dist[2]) },
      1: { count: dist[1], percentage: pct(dist[1]) }
    },
    recommendationPercentage,
    recommendationResponseCount: recResponses.length,
    productAverages
  };
}

export function getAdminStats() {
  const all = readReviews();
  const total = all.length;
  const pending = all.filter(r => r.status === 'PENDING').length;
  const approvedList = all.filter(r => r.status === 'APPROVED');
  const approved = approvedList.length;
  const rejected = all.filter(r => r.status === 'REJECTED').length;
  const hidden = all.filter(r => r.status === 'HIDDEN').length;
  const rejectedOrHidden = rejected + hidden;

  // Average Rating strictly from published (APPROVED) reviews only
  const sumApp = approvedList.reduce((acc, r) => acc + (r.overall_rating || 0), 0);
  const avg = approved > 0 ? parseFloat((sumApp / approved).toFixed(2)) : 0;

  // Recommendation Percentage strictly from actual explicit Yes/No responses on published/submitted reviews
  const recSource = approvedList.length > 0 ? approvedList : all;
  const recResponses = recSource.filter(r => VALID_RECOMMENDATIONS.has(r.recommendation));
  const recommendYes = recResponses.filter(r => r.recommendation === 'Definitely!').length;
  const recommendationPercentage = recResponses.length > 0
    ? Math.round((recommendYes / recResponses.length) * 100)
    : null;

  const verifiedCount = all.filter(r => r.purchase_verification_status === 'VERIFIED_PURCHASE').length;
  const unverifiedCount = total - verifiedCount;
  const flaggedCount = all.filter(r => r.flagged_for_review).length;

  return {
    total,
    pending,
    approved,
    rejected,
    hidden,
    rejectedOrHidden,
    verifiedCount,
    unverifiedCount,
    flaggedCount,
    averageRating: avg,
    recommendationPercentage,
    recommendationResponseCount: recResponses.length
  };
}

export function getAdminReviews({ page = 1, limit = 15, status, product, rating, verification, flagged, search, sort = 'newest' } = {}) {
  const all = readReviews();
  let list = [...all];

  if (status && status !== 'ALL') {
    if (status === 'REJECTED_OR_HIDDEN') {
      list = list.filter(r => r.status === 'REJECTED' || r.status === 'HIDDEN');
    } else {
      list = list.filter(r => r.status === status);
    }
  }
  if (product) list = list.filter(r => r.product_name === normalizeProductName(product));
  if (rating) list = list.filter(r => r.overall_rating === parseInt(rating, 10));
  if (verification === 'VERIFIED_PURCHASE') {
    list = list.filter(r => r.purchase_verification_status === 'VERIFIED_PURCHASE');
  } else if (verification === 'UNVERIFIED') {
    list = list.filter(r => r.purchase_verification_status !== 'VERIFIED_PURCHASE');
  }
  if (flagged === 'true' || flagged === true) {
    list = list.filter(r => r.flagged_for_review);
  }
  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter(r =>
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.customer_email || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q) ||
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.order_ref || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    if (sort === 'highest') return b.overall_rating - a.overall_rating || new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'lowest') return a.overall_rating - b.overall_rating || new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'helpful') return (b.helpful_count || 0) - (a.helpful_count || 0) || new Date(b.created_at) - new Date(a.created_at);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const total = list.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 15));
  const offset = (p - 1) * l;
  const paginated = list.slice(offset, offset + l).map(sanitizeAdminReview);

  return { reviews: paginated, total, page: p, totalPages: Math.ceil(total / l) || 1 };
}

export function getAdminReviewDetails(id) {
  const all = readReviews();
  const rev = all.find(r => r.id === id);
  if (!rev) return null;

  const auditLogs = readAuditLogs().filter(l => l.review_id === id);
  const versions = readVersions().filter(v => v.review_id === id);
  return {
    review: sanitizeAdminReview(rev),
    auditLogs,
    versions
  };
}

export function getAuditLogsForAdmin(limit = 100) {
  return readAuditLogs().slice(0, limit);
}

export function createReview(data) {
  const all = readReviews();
  const productName = normalizeProductName(data.productName);
  const productId = PRODUCT_SLUG_MAP[productName] || null;
  const cleanName = String(data.customerName || '').trim();
  const cleanEmail = data.customerEmail ? String(data.customerEmail).trim().toLowerCase() : null;
  const cleanPhone = data.customerPhone ? String(data.customerPhone).replace(/\D/g, '').slice(-10) : null;
  const cleanOrderRef = data.orderRef ? String(data.orderRef).trim().toUpperCase() : null;
  const cleanComment = String(data.comment || '').trim();
  const customerId = cleanPhone || cleanEmail || null;

  // Never trust client-supplied purchaseVerified/status flags: run server-side verification only
  const verification = findMatchingDeliveredOrder({
    orderRef: cleanOrderRef,
    customerPhone: cleanPhone,
    customerEmail: cleanEmail,
    productName,
    productId
  });

  // Enforce 1 review per eligible order + product combination
  if (verification.verified) {
    const existingOrderRev = all.find(
      r => r.order_id === verification.orderId && r.product_name === productName
    );
    if (existingOrderRev) {
      return {
        error: 'A review has already been submitted for this product on this order. You can edit your existing review instead.',
        code: 'DUPLICATE_ORDER_REVIEW',
        existingReviewId: existingOrderRev.id
      };
    }
  }

  // Prevent duplicate identical submissions or repeated reviews from same customer identity + product + orderRef
  const dupContent = all.find(r => {
    const sameIdentity =
      (cleanPhone && r.customer_phone && r.customer_phone === cleanPhone) ||
      (cleanEmail && r.customer_email && r.customer_email.toLowerCase() === cleanEmail) ||
      (r.customer_name.toLowerCase() === cleanName.toLowerCase());
    if (!sameIdentity || r.product_name !== productName) return false;
    if (cleanOrderRef && r.order_ref === cleanOrderRef) return true;
    return r.comment.toLowerCase() === cleanComment.toLowerCase();
  });
  if (dupContent) {
    return {
      error: 'A duplicate review for this product has already been recorded.',
      code: 'DUPLICATE_REVIEW',
      existingReviewId: dupContent.id
    };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const editToken = crypto.randomBytes(24).toString('hex');
  const suspiciousReason = detectSuspiciousContent(cleanComment);

  const isVerified = Boolean(verification.verified);
  const verificationEvidence = isVerified
    ? {
        orderId: verification.orderId,
        orderRef: verification.orderRef,
        orderItemId: verification.orderItemId,
        deliveredAt: verification.deliveredAt,
        matchedBy: verification.matchedBy,
        verifiedAt: verification.verifiedAt
      }
    : null;

  const parseOptRating = v => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };

  const newReview = {
    id,
    customer_id: customerId,
    product_id: productId,
    customer_name: cleanName,
    customer_email: cleanEmail,
    customer_phone: cleanPhone && /^[6-9]\d{9}$/.test(cleanPhone) ? cleanPhone : null,
    product_name: productName,
    order_id: isVerified ? verification.orderId : null,
    order_ref: isVerified ? verification.orderRef : cleanOrderRef,
    order_item_id: isVerified ? verification.orderItemId : null,
    overall_rating: Number(data.overallRating) || 5,
    taste_rating: parseOptRating(data.tasteRating),
    creaminess_rating: parseOptRating(data.creaminessRating),
    coffee_intensity_rating: parseOptRating(data.coffeeIntensityRating),
    sweetness_rating: parseOptRating(data.sweetnessRating),
    texture_rating: parseOptRating(data.textureRating),
    chocolate_rating: parseOptRating(data.chocolateRating),
    presentation_rating: parseOptRating(data.presentationRating),
    sweetness_preference: data.sweetnessPreference || null,
    coffee_preference: data.coffeePreference || null,
    texture_preference: data.texturePreference || null,
    feedback_tags: Array.isArray(data.feedbackTags) ? data.feedbackTags.slice(0, 10) : [],
    comment: cleanComment,
    recommendation: VALID_RECOMMENDATIONS.has(data.recommendation) ? data.recommendation : null,
    status: 'PENDING',
    verified_purchase: isVerified,
    purchase_verification_status: isVerified ? 'VERIFIED_PURCHASE' : 'UNVERIFIED',
    verification_evidence: verificationEvidence,
    flagged_for_review: Boolean(suspiciousReason),
    flag_reason: suspiciousReason,
    moderation_reason: null,
    edit_token_hash: hashToken(editToken),
    helpful_count: 0,
    created_at: now,
    updated_at: now,
    published_at: null,
    moderated_at: null,
    moderated_by: null
  };

  all.unshift(newReview);
  writeReviews(all);

  appendVersion(newReview, cleanName);
  appendAuditLog({
    reviewId: id,
    actorType: 'customer',
    actorId: customerId || cleanName,
    action: 'SUBMITTED',
    previousStatus: null,
    newStatus: 'PENDING',
    metadata: {
      verificationStatus: newReview.purchase_verification_status,
      verificationReason: isVerified ? verification.matchedBy : verification.reason
    }
  });

  if (suspiciousReason) {
    appendAuditLog({
      reviewId: id,
      actorType: 'system',
      actorId: 'integrity-check',
      action: 'FLAGGED',
      previousStatus: 'PENDING',
      newStatus: 'PENDING',
      reason: suspiciousReason
    });
  }

  return {
    review: sanitizePublicReview(newReview),
    verificationStatus: newReview.purchase_verification_status,
    verificationReason: isVerified ? 'Matched to a completed delivered order.' : verification.reason,
    editToken
  };
}

export function getReviewForCustomerEdit(id, editToken) {
  if (!id || !editToken) return null;
  const all = readReviews();
  const rev = all.find(r => r.id === id);
  if (!rev || !rev.edit_token_hash) return null;

  const suppliedHash = Buffer.from(hashToken(editToken));
  const storedHash = Buffer.from(rev.edit_token_hash);
  if (suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(suppliedHash, storedHash)) {
    return null;
  }

  return sanitizePublicReview(rev);
}

export function updateCustomerReview(id, editToken, updates) {
  if (!id || !editToken) {
    return { error: 'Authorization token required to edit review.', statusCode: 401 };
  }
  const all = readReviews();
  const rev = all.find(r => r.id === id);
  if (!rev || !rev.edit_token_hash) {
    return { error: 'Review not found or customer editing is not available for this record.', statusCode: 404 };
  }

  const suppliedHash = Buffer.from(hashToken(editToken));
  const storedHash = Buffer.from(rev.edit_token_hash);
  if (suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(suppliedHash, storedHash)) {
    return { error: 'Invalid review edit token.', statusCode: 403 };
  }

  const prevStatus = rev.status;
  const parseOptRating = v => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };

  if (updates.customerName && String(updates.customerName).trim().length >= 2) {
    rev.customer_name = String(updates.customerName).trim().slice(0, 80);
  }
  if (updates.overallRating !== undefined) {
    const r = Number(updates.overallRating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return { error: 'Overall rating must be between 1 and 5.', statusCode: 400 };
    }
    rev.overall_rating = r;
  }
  if (updates.comment !== undefined) {
    const clean = String(updates.comment).replace(/<[^>]*>/g, '').trim();
    if (clean.length < 10 || clean.length > 1000) {
      return { error: 'Review text must be between 10 and 1000 characters.', statusCode: 400 };
    }
    rev.comment = clean;
  }

  const optionalRatingsMap = {
    tasteRating: 'taste_rating',
    creaminessRating: 'creaminess_rating',
    coffeeIntensityRating: 'coffee_intensity_rating',
    sweetnessRating: 'sweetness_rating',
    textureRating: 'texture_rating',
    chocolateRating: 'chocolate_rating',
    presentationRating: 'presentation_rating',
  };
  for (const [inKey, dbKey] of Object.entries(optionalRatingsMap)) {
    if (updates[inKey] !== undefined) {
      rev[dbKey] = updates[inKey] ? parseOptRating(updates[inKey]) : null;
    }
  }
  if (updates.recommendation !== undefined) {
    rev.recommendation = VALID_RECOMMENDATIONS.has(updates.recommendation) ? updates.recommendation : null;
  }
  if (Array.isArray(updates.feedbackTags)) {
    rev.feedback_tags = updates.feedbackTags.slice(0, 10);
  }

  const now = new Date().toISOString();
  rev.updated_at = now;
  rev.customer_edited = true;
  // Re-enter moderation queue after customer edit to protect against post-approval spam injection;
  // preserves purchase_verification_status & verification_evidence intact!
  rev.status = 'PENDING';
  const suspiciousReason = detectSuspiciousContent(rev.comment);
  rev.flagged_for_review = Boolean(suspiciousReason);
  rev.flag_reason = suspiciousReason;

  writeReviews(all);
  appendVersion(rev, rev.customer_name);
  appendAuditLog({
    reviewId: rev.id,
    actorType: 'customer',
    actorId: rev.customer_id || rev.customer_name,
    action: 'CUSTOMER_EDITED',
    previousStatus: prevStatus,
    newStatus: 'PENDING',
    reason: 'Customer updated their own review; queued for re-moderation.'
  });

  return { review: sanitizePublicReview(rev) };
}

/**
 * Strict Admin Moderation:
 * Admins can APPROVE, REJECT, HIDE, or RESTORE.
 * Admins CANNOT modify customer opinion fields (comment, ratings, recommendation, created_at)
 * and CANNOT grant Verified Purchase status!
 */
export function moderateReview({ id, action, adminId = 'Store Admin', reason = '' }) {
  const all = readReviews();
  const rev = all.find(r => r.id === id);
  if (!rev) return { error: 'Review not found.', statusCode: 404 };

  const cleanReason = String(reason || '').trim();
  const prevStatus = rev.status;
  let newStatus = prevStatus;
  let auditAction = action;

  if (action === 'APPROVE') {
    newStatus = 'APPROVED';
    auditAction = 'APPROVED';
    if (!rev.published_at) rev.published_at = new Date().toISOString();
    rev.flagged_for_review = false;
  } else if (action === 'REJECT') {
    if (cleanReason.length < 3) {
      return { error: 'An internal moderation reason is required to reject a review.', statusCode: 400 };
    }
    newStatus = 'REJECTED';
    auditAction = 'REJECTED';
  } else if (action === 'HIDE') {
    if (prevStatus !== 'APPROVED') {
      return { error: 'Only currently published reviews can be hidden.', statusCode: 400 };
    }
    if (cleanReason.length < 3) {
      return { error: 'An internal moderation reason is required to hide a published review.', statusCode: 400 };
    }
    newStatus = 'HIDDEN';
    auditAction = 'HIDDEN';
  } else if (action === 'RESTORE') {
    if (prevStatus !== 'HIDDEN' && prevStatus !== 'REJECTED') {
      return { error: 'Only hidden or rejected reviews can be restored.', statusCode: 400 };
    }
    newStatus = 'APPROVED';
    auditAction = 'RESTORED';
    if (!rev.published_at) rev.published_at = new Date().toISOString();
  } else {
    return { error: 'Invalid moderation action.', statusCode: 400 };
  }

  const now = new Date().toISOString();
  rev.status = newStatus;
  rev.moderation_reason = cleanReason || rev.moderation_reason;
  rev.moderated_at = now;
  rev.moderated_by = adminId;
  // Intentionally do NOT alter updated_at/created_at for customer text or verified_purchase!

  writeReviews(all);
  appendAuditLog({
    reviewId: id,
    actorType: 'admin',
    actorId: adminId,
    action: auditAction,
    previousStatus: prevStatus,
    newStatus,
    reason: cleanReason || null
  });

  return { review: sanitizeAdminReview(rev) };
}

// Legacy wrapper preserving compatibility if needed
export function updateReviewStatus(id, newStatus, moderatedBy = 'Store Admin', reason = '') {
  const actionMap = { APPROVED: 'APPROVE', REJECTED: 'REJECT', HIDDEN: 'HIDE' };
  const mapped = actionMap[newStatus];
  if (!mapped) return null;
  const res = moderateReview({ id, action: mapped, adminId: moderatedBy, reason: reason || 'Admin moderation' });
  return res.review || null;
}

export function deleteReview(id, { adminId = 'Store Admin', reasonCategory, reason } = {}) {
  const cleanCategory = String(reasonCategory || '').trim();
  const cleanReason = String(reason || '').trim();

  if (!VALID_DELETE_REASONS.has(cleanCategory)) {
    return {
      error: 'Permanent deletion requires a legitimate reason category (duplicate, privacy_erasure, legal_compliance, or spam_fraud). Negative reviews cannot be deleted simply for being negative.',
      statusCode: 400
    };
  }
  if (cleanReason.length < 5) {
    return {
      error: 'Please provide a specific internal explanation (at least 5 characters) for deleting this record.',
      statusCode: 400
    };
  }

  const all = readReviews();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return { error: 'Review not found.', statusCode: 404 };

  const target = all[idx];
  // Block deleting genuine negative reviews under bogus non-eligible criteria if helpful votes/order exist unless privacy/legal
  if (
    target.overall_rating <= 2 &&
    target.purchase_verification_status === 'VERIFIED_PURCHASE' &&
    cleanCategory === 'spam_fraud'
  ) {
    return {
      error: 'Verified-purchase negative feedback cannot be permanently deleted as spam. Use Hide with an internal reason if there is a policy violation.',
      statusCode: 403
    };
  }

  appendAuditLog({
    reviewId: id,
    actorType: 'admin',
    actorId: adminId,
    action: 'DELETED',
    previousStatus: target.status,
    newStatus: 'DELETED',
    reason: `[${cleanCategory}] ${cleanReason}`,
    metadata: {
      productName: target.product_name,
      overallRating: target.overall_rating,
      verificationStatus: target.purchase_verification_status
    }
  });

  all.splice(idx, 1);
  writeReviews(all);
  return { deleted: true };
}

export function upvoteReviewHelpful(reviewId, voterHash) {
  if (!reviewId || !voterHash) return { voted: false, error: 'Invalid vote request.' };

  const all = readReviews();
  const rev = all.find(r => r.id === reviewId && r.status === 'APPROVED');
  if (!rev) return { voted: false, notFound: true };

  const votes = readVotes();
  const alreadyVoted = votes.some(v => v.review_id === reviewId && v.voter_hash === voterHash);
  if (alreadyVoted) {
    return { voted: false, duplicate: true, helpfulCount: rev.helpful_count || 0 };
  }

  votes.push({
    id: crypto.randomUUID(),
    review_id: reviewId,
    voter_hash: voterHash,
    created_at: new Date().toISOString()
  });
  writeVotes(votes);

  rev.helpful_count = (rev.helpful_count || 0) + 1;
  writeReviews(all);

  return { voted: true, helpfulCount: rev.helpful_count };
}
