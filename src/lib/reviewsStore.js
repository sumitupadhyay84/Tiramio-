import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

const INITIAL_REVIEWS = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    customer_name: 'Ananya Sharma',
    customer_email: 'ananya@example.com',
    product_name: 'Dear Misu Classic (200g)',
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
    customer_image_url: null,
    recommendation: 'Definitely!',
    status: 'APPROVED',
    verified_purchase: true,
    helpful_count: 14,
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    moderated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    moderated_by: 'Store Admin'
  },
  {
    id: 'c9b8d4f2-1a3e-4b5c-8d7e-9f0a1b2c3d4e',
    customer_name: 'Vikram Mehta',
    customer_email: 'vikram.m@example.com',
    product_name: 'Dear Misu Share Box (300g)',
    overall_rating: 5,
    taste_rating: 5,
    creaminess_rating: 5,
    coffee_intensity_rating: 5,
    sweetness_rating: 4,
    texture_rating: 5,
    chocolate_rating: 5,
    presentation_rating: 5,
    sweetness_preference: 'Just right',
    coffee_preference: 'Strong',
    texture_preference: 'Rich and layered',
    feedback_tags: ['Rich coffee flavour', 'Perfect portion size', 'Fresh and delicious', 'Absolutely loved it'],
    comment: 'Ordered for our family dinner and it vanished in minutes! Outstanding cocoa finish and the ladyfinger layers were soaked to perfection.',
    customer_image_url: null,
    recommendation: 'Definitely!',
    status: 'APPROVED',
    verified_purchase: true,
    helpful_count: 9,
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    moderated_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    moderated_by: 'Store Admin'
  },
  {
    id: 'e1d2c3b4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
    customer_name: 'Priya Iyer',
    customer_email: 'priya.iyer@example.com',
    product_name: 'Dear Misu Mini (100g)',
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
    customer_image_url: null,
    recommendation: 'Definitely!',
    status: 'PENDING',
    verified_purchase: false,
    helpful_count: 2,
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    moderated_at: null,
    moderated_by: null
  }
];

function initStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(INITIAL_REVIEWS, null, 2), 'utf-8');
  }
}

function readReviews() {
  try {
    initStore();
    const data = fs.readFileSync(REVIEWS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading reviews file:', err);
    return INITIAL_REVIEWS;
  }
}

function writeReviews(reviews) {
  try {
    initStore();
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing reviews file:', err);
    return false;
  }
}

export function getPublicReviews({ page = 1, limit = 6, product, rating, sort = 'oldest' } = {}) {
  const all = readReviews();
  let list = all.filter(r => r.status === 'APPROVED');

  if (product) list = list.filter(r => r.product_name === product);
  if (rating) list = list.filter(r => r.overall_rating === parseInt(rating, 10));

  list.sort((a, b) => {
    if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'highest') return b.overall_rating - a.overall_rating || new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'lowest') return a.overall_rating - b.overall_rating || new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'helpful') return (b.helpful_count || 0) - (a.helpful_count || 0) || new Date(a.created_at) - new Date(b.created_at);
    // Default: 'oldest' (chronological: earliest to latest)
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const total = list.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 6));
  const offset = (p - 1) * l;
  const paginated = list.slice(offset, offset + l).map(r => {
    // Privacy: never expose customer_email in public listing
    const { customer_email, ...safe } = r;
    return safe;
  });

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
      distribution: { 5: { count: 0, percentage: 0 }, 4: { count: 0, percentage: 0 }, 3: { count: 0, percentage: 0 }, 2: { count: 0, percentage: 0 }, 1: { count: 0, percentage: 0 } },
      recommendationPercentage: 0,
      productAverages: []
    };
  }

  const sumRatings = approved.reduce((acc, r) => acc + (r.overall_rating || 0), 0);
  const avg = parseFloat((sumRatings / total).toFixed(2));

  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  approved.forEach(r => {
    const star = Math.min(5, Math.max(1, Math.round(r.overall_rating)));
    dist[star] = (dist[star] || 0) + 1;
  });

  const pct = n => Math.round((n / total) * 100);
  const recommendYes = approved.filter(r => r.recommendation === 'Definitely!').length;

  // Product averages
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
    distribution: {
      5: { count: dist[5], percentage: pct(dist[5]) },
      4: { count: dist[4], percentage: pct(dist[4]) },
      3: { count: dist[3], percentage: pct(dist[3]) },
      2: { count: dist[2], percentage: pct(dist[2]) },
      1: { count: dist[1], percentage: pct(dist[1]) }
    },
    recommendationPercentage: pct(recommendYes),
    productAverages
  };
}

export function getAdminStats() {
  const all = readReviews();
  const total = all.length;
  const pending = all.filter(r => r.status === 'PENDING').length;
  const approved = all.filter(r => r.status === 'APPROVED').length;
  const rejected = all.filter(r => r.status === 'REJECTED').length;

  const appList = all.filter(r => r.status === 'APPROVED');
  const sumApp = appList.reduce((acc, r) => acc + (r.overall_rating || 0), 0);
  const avg = appList.length ? parseFloat((sumApp / appList.length).toFixed(1)) : 0;
  const recommendYes = all.filter(r => r.recommendation === 'Definitely!').length;

  return {
    total,
    pending,
    approved,
    rejected,
    averageRating: avg,
    recommendationPercentage: total ? Math.round((recommendYes / total) * 100) : 0
  };
}

export function getAdminReviews({ page = 1, limit = 15, status, product, rating, search, sort = 'newest' } = {}) {
  const all = readReviews();
  let list = [...all];

  if (status && status !== 'ALL') list = list.filter(r => r.status === status);
  if (product) list = list.filter(r => r.product_name === product);
  if (rating) list = list.filter(r => r.overall_rating === parseInt(rating, 10));
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(r => (r.customer_name || '').toLowerCase().includes(q) || (r.comment || '').toLowerCase().includes(q));
  }

  list.sort((a, b) => {
    if (sort === 'highest') return b.overall_rating - a.overall_rating;
    if (sort === 'lowest') return a.overall_rating - b.overall_rating;
    if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'helpful') return (b.helpful_count || 0) - (a.helpful_count || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const total = list.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 15));
  const offset = (p - 1) * l;
  const paginated = list.slice(offset, offset + l);

  return { reviews: paginated, total, page: p, totalPages: Math.ceil(total / l) || 1 };
}

export function createReview(data) {
  const all = readReviews();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const newReview = {
    id,
    customer_name: String(data.customerName || '').trim(),
    customer_email: String(data.customerEmail || '').trim() || null,
    product_name: data.productName,
    overall_rating: Number(data.overallRating) || 5,
    taste_rating: data.tasteRating ? Number(data.tasteRating) : null,
    creaminess_rating: data.creaminessRating ? Number(data.creaminessRating) : null,
    coffee_intensity_rating: data.coffeeIntensityRating ? Number(data.coffeeIntensityRating) : null,
    sweetness_rating: data.sweetnessRating ? Number(data.sweetnessRating) : null,
    texture_rating: data.textureRating ? Number(data.textureRating) : null,
    chocolate_rating: data.chocolateRating ? Number(data.chocolateRating) : null,
    presentation_rating: data.presentationRating ? Number(data.presentationRating) : null,
    sweetness_preference: data.sweetnessPreference || null,
    coffee_preference: data.coffeePreference || null,
    texture_preference: data.texturePreference || null,
    feedback_tags: Array.isArray(data.feedbackTags) ? data.feedbackTags : [],
    comment: String(data.comment || '').trim(),
    customer_image_url: data.customerImageUrl || null,
    recommendation: data.recommendation || null,
    status: 'PENDING',
    verified_purchase: false,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
    moderated_at: null,
    moderated_by: null
  };

  all.unshift(newReview);
  writeReviews(all);
  return newReview;
}

export function updateReviewStatus(id, newStatus, moderatedBy = 'Store Admin') {
  const all = readReviews();
  const rev = all.find(r => r.id === id);
  if (!rev) return null;

  rev.status = newStatus;
  rev.moderated_at = new Date().toISOString();
  rev.moderated_by = moderatedBy;
  rev.updated_at = new Date().toISOString();
  if (newStatus === 'APPROVED') {
    rev.verified_purchase = true;
  }

  writeReviews(all);
  return rev;
}

export function deleteReview(id) {
  const all = readReviews();
  const idx = all.findIndex(r => r.id === id);
  if (idx === -1) return false;

  all.splice(idx, 1);
  writeReviews(all);
  return true;
}

const helpfulVotes = new Set();
export function upvoteReviewHelpful(reviewId, voterIpHash) {
  const key = `${reviewId}:${voterIpHash}`;
  if (helpfulVotes.has(key)) return { voted: false, duplicate: true };

  const all = readReviews();
  const rev = all.find(r => r.id === reviewId);
  if (!rev) return { voted: false, notFound: true };

  rev.helpful_count = (rev.helpful_count || 0) + 1;
  helpfulVotes.add(key);
  writeReviews(all);
  return { voted: true, helpfulCount: rev.helpful_count };
}

