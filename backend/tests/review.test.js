const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let tempRoot;
let originalCwd;
let reviewsStore;
let ordersStore;
let adminAuth;

test.before(async () => {
  originalCwd = process.cwd();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dearmisu-reviews-test-'));
  fs.mkdirSync(path.join(tempRoot, 'data'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'data', 'reviews.json'), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(tempRoot, 'data', 'orders.json'), JSON.stringify([], null, 2));

  process.chdir(tempRoot);

  const storefrontRoot = path.resolve(originalCwd, 'tiramio-storefront');
  const altStorefrontRoot = path.resolve(originalCwd);
  const baseDir = fs.existsSync(path.join(storefrontRoot, 'src', 'lib', 'reviewsStore.js'))
    ? storefrontRoot
    : altStorefrontRoot;

  reviewsStore = await import(pathToFileURL(path.join(baseDir, 'src', 'lib', 'reviewsStore.js')).href);
  ordersStore = await import(pathToFileURL(path.join(baseDir, 'src', 'lib', 'ordersStore.js')).href);
  adminAuth = await import(pathToFileURL(path.join(baseDir, 'src', 'lib', 'adminAuth.js')).href);
});

test.after(() => {
  process.chdir(originalCwd);
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('Purchase Verification - Completed matching delivered order grants Verified Purchase', () => {
  const order = ordersStore.createOrder({
    orderRef: 'DEAR-2001',
    customerName: 'Aarav Patel',
    phone: '9876543210',
    fulfilment: 'Delivery',
    address: 'Indiranagar, Bangalore',
    paymentId: 'UTR123456789',
    items: [{ productId: 'classic', quantity: 1 }]
  });
  ordersStore.updateOrderStatus(order.order_ref, 'delivered', 'Delivered to customer');

  const res = reviewsStore.createReview({
    customerName: 'Aarav P.',
    customerPhone: '9876543210',
    customerEmail: 'aarav@example.com',
    orderRef: 'DEAR-2001',
    productName: 'Dear Misu Classic',
    overallRating: 5,
    comment: 'Silky mascarpone and rich espresso layers, arrived fresh!'
  });

  assert.equal(res.verificationStatus, 'VERIFIED_PURCHASE');
  assert.equal(res.review.purchase_verification_status, 'VERIFIED_PURCHASE');
  assert.equal(res.review.verified_purchase, true);
  // Private info never exposed in public review response
  assert.equal('customer_email' in res.review, false);
  assert.equal('customer_phone' in res.review, false);
  assert.equal('verification_evidence' in res.review, false);
  assert.ok(res.editToken);
});

test('Purchase Verification - Incomplete, cancelled, wrong-product, or mismatched customer order stays Unverified', () => {
  // Incomplete (placed) order
  ordersStore.createOrder({
    orderRef: 'DEAR-2002',
    customerName: 'Neha Rao',
    phone: '9876500001',
    fulfilment: 'Pickup',
    items: [{ productId: 'mini', quantity: 1 }]
  });

  const pendingOrderRev = reviewsStore.createReview({
    customerName: 'Neha R.',
    customerPhone: '9876500001',
    orderRef: 'DEAR-2002',
    productName: 'Dear Misu Mini',
    overallRating: 4,
    comment: 'Excited to try, placed order today and waiting to taste!'
  });
  assert.equal(pendingOrderRev.verificationStatus, 'UNVERIFIED');

  // Cancelled order does not qualify
  ordersStore.updateOrderStatus('DEAR-2002', 'cancelled', 'Cancelled by user');
  const cancelledRev = reviewsStore.createReview({
    customerName: 'Neha R.',
    customerPhone: '9876500001',
    orderRef: 'DEAR-2002',
    productName: 'Dear Misu Classic',
    overallRating: 2,
    comment: 'Tried submitting review for a cancelled order reference.'
  });
  assert.equal(cancelledRev.verificationStatus, 'UNVERIFIED');

  // Wrong product against delivered DEAR-2001
  const wrongProdRev = reviewsStore.createReview({
    customerName: 'Aarav P.',
    customerPhone: '9876543210',
    orderRef: 'DEAR-2001',
    productName: 'Dear Misu Share Box',
    overallRating: 5,
    comment: 'Trying to verify Share Box using a Classic order reference.'
  });
  assert.equal(wrongProdRev.verificationStatus, 'UNVERIFIED');

  // Unrelated customer phone trying to spoof DEAR-2001
  const unrelatedCustomerRev = reviewsStore.createReview({
    customerName: 'Spoofer',
    customerPhone: '9999999999',
    orderRef: 'DEAR-2001',
    productName: 'Dear Misu Classic',
    overallRating: 1,
    comment: 'Trying to guess order number without matching customer phone.'
  });
  assert.equal(unrelatedCustomerRev.verificationStatus, 'UNVERIFIED');
});

test('Duplicate Order Prevention - Blocks duplicate review for same delivered order + product', () => {
  const dup = reviewsStore.createReview({
    customerName: 'Aarav P.',
    customerPhone: '9876543210',
    orderRef: 'DEAR-2001',
    productName: 'Dear Misu Classic',
    overallRating: 4,
    comment: 'Trying to submit a second review for the same order item.'
  });
  assert.equal(dup.code, 'DUPLICATE_ORDER_REVIEW');
});

test('Moderation Independence & Lifecycle - Approve never fakes Verified Purchase; Hide/Restore/Reject & negative reviews', () => {
  // Negative unverified review must still be eligible for approval
  const neg = reviewsStore.createReview({
    customerName: 'Kiran',
    productName: 'Dear Misu Mini',
    overallRating: 2,
    comment: 'Too bitter for my personal taste today, delivery was fine.'
  });
  assert.equal(neg.review.status, 'PENDING');
  assert.equal(neg.verificationStatus, 'UNVERIFIED');

  // Not visible publicly while PENDING
  let pub = reviewsStore.getPublicReviews({ limit: 50 });
  assert.equal(pub.reviews.some(r => r.id === neg.review.id), false);

  // Approve -> becomes APPROVED, stays UNVERIFIED!
  const approvedNeg = reviewsStore.moderateReview({
    id: neg.review.id,
    action: 'APPROVE',
    adminId: 'admin@fitpulse.com',
    reason: 'Genuine negative feedback approved'
  });
  assert.equal(approvedNeg.review.status, 'APPROVED');
  assert.equal(approvedNeg.review.verified_purchase, false);
  assert.equal(approvedNeg.review.purchase_verification_status, 'UNVERIFIED');

  pub = reviewsStore.getPublicReviews({ limit: 50 });
  assert.equal(pub.reviews.some(r => r.id === neg.review.id), true);

  // Hide requires reason
  const missingReason = reviewsStore.moderateReview({
    id: neg.review.id,
    action: 'HIDE',
    adminId: 'admin@fitpulse.com',
    reason: ''
  });
  assert.ok(missingReason.error);

  // Hide with valid reason removes from public view
  const hidden = reviewsStore.moderateReview({
    id: neg.review.id,
    action: 'HIDE',
    adminId: 'admin@fitpulse.com',
    reason: 'Temporary customer support follow-up'
  });
  assert.equal(hidden.review.status, 'HIDDEN');
  pub = reviewsStore.getPublicReviews({ limit: 50 });
  assert.equal(pub.reviews.some(r => r.id === neg.review.id), false);

  // Restore makes visible again
  const restored = reviewsStore.moderateReview({
    id: neg.review.id,
    action: 'RESTORE',
    adminId: 'admin@fitpulse.com',
    reason: 'Issue resolved with customer'
  });
  assert.equal(restored.review.status, 'APPROVED');
  pub = reviewsStore.getPublicReviews({ limit: 50 });
  assert.equal(pub.reviews.some(r => r.id === neg.review.id), true);
});

test('Review Integrity & Audit Trail - Customer edit preserves version history; admin deletion restricted', () => {
  const created = reviewsStore.createReview({
    customerName: 'Meera',
    productName: 'Dear Misu Share Box',
    overallRating: 4,
    comment: 'Loved the texture and generous portion for our family gathering.'
  });

  // Customer edit with wrong token fails
  const badEdit = reviewsStore.updateCustomerReview(created.review.id, 'wrong-token', {
    overallRating: 5,
    comment: 'Unauthorized edit attempt should be rejected cleanly.'
  });
  assert.equal(badEdit.statusCode, 403);

  // Customer edit with valid token succeeds & stores version + audit log
  const goodEdit = reviewsStore.updateCustomerReview(created.review.id, created.editToken, {
    overallRating: 5,
    comment: 'Updated after tasting chilled overnight — even better next day!'
  });
  assert.equal(goodEdit.review.overall_rating, 5);
  assert.equal(goodEdit.review.status, 'PENDING');

  const details = reviewsStore.getAdminReviewDetails(created.review.id);
  assert.equal(details.versions.length, 2);
  assert.equal(details.auditLogs.some(l => l.action === 'CUSTOMER_EDITED'), true);

  // Admin delete requires valid category + reason
  const invalidDel = reviewsStore.deleteReview(created.review.id, {
    adminId: 'admin',
    reasonCategory: 'i_dont_like_it',
    reason: 'Negative'
  });
  assert.ok(invalidDel.error);
});

test('Public Stats, Filtering, and Helpful Voting - Accurate calculations & no duplicate votes', () => {
  const order = ordersStore.createOrder({
    orderRef: 'DEAR-2009',
    customerName: 'Rohan',
    phone: '9876511111',
    fulfilment: 'Delivery',
    address: 'Koramangala',
    items: [{ productId: 'mini', quantity: 1 }]
  });
  ordersStore.updateOrderStatus(order.order_ref, 'delivered');

  const vRev = reviewsStore.createReview({
    customerName: 'Rohan',
    customerPhone: '9876511111',
    orderRef: 'DEAR-2009',
    productName: 'Dear Misu Mini',
    overallRating: 5,
    recommendation: 'Definitely!',
    comment: 'Fresh cocoa dusting and balanced sweetness, verified order!'
  });
  reviewsStore.moderateReview({ id: vRev.review.id, action: 'APPROVE', adminId: 'admin', reason: 'Valid review' });

  // Verified filter returns only verified purchases
  const verifiedOnly = reviewsStore.getPublicReviews({ verification: 'VERIFIED_PURCHASE' });
  assert.ok(verifiedOnly.reviews.length >= 1);
  assert.ok(verifiedOnly.reviews.every(r => r.purchase_verification_status === 'VERIFIED_PURCHASE'));

  // Public stats reflects published reviews & real recommendation count
  const stats = reviewsStore.getPublicStats();
  assert.ok(stats.totalReviews >= 2);
  assert.ok(stats.verifiedPurchaseCount >= 1);
  assert.equal(stats.recommendationResponseCount, 1);
  assert.equal(stats.recommendationPercentage, 100);

  // Helpful vote increments once per voter hash and blocks duplicates
  const firstVote = reviewsStore.upvoteReviewHelpful(vRev.review.id, 'voter-hash-1');
  assert.equal(firstVote.voted, true);
  assert.equal(firstVote.helpfulCount, 1);

  const dupVote = reviewsStore.upvoteReviewHelpful(vRev.review.id, 'voter-hash-1');
  assert.equal(dupVote.voted, false);
  assert.equal(dupVote.duplicate, true);
  assert.equal(dupVote.helpfulCount, 1);
});

test('Admin Auth & Role Check - Token parsing enforces administrator role and rejects tampered tokens', () => {
  const token = adminAuth.createAdminToken('admin@fitpulse.com');
  const parsed = adminAuth.parseAdminToken(token);
  assert.equal(parsed.authenticated, true);
  assert.equal(parsed.role, 'administrator');
  assert.equal(parsed.username, 'admin@fitpulse.com');

  const tampered = token.slice(0, -4) + 'xxxx';
  assert.equal(adminAuth.parseAdminToken(tampered), null);
});

test('Left-to-Right Date Ordering - Latest review approved first & earlier review approved later auto-adjusts by date', () => {
  // Seed earlier review (17 Nov) and current review (25 Nov)
  const earlier = reviewsStore.createReview({
    customerName: 'Early Customer',
    productName: 'Dear Misu Classic',
    overallRating: 5,
    comment: 'Submitted earlier on 17 Nov before current review.'
  });
  const current = reviewsStore.createReview({
    customerName: 'Current Customer',
    productName: 'Dear Misu Classic',
    overallRating: 5,
    comment: 'Submitted later on 25 Nov and approved first.'
  });

  // Assign distinct created_at timestamps in stored reviews to simulate 17 Nov vs 25 Nov
  const file = path.join(tempRoot, 'data', 'reviews.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const eRow = rows.find(r => r.id === earlier.review.id);
  const cRow = rows.find(r => r.id === current.review.id);
  eRow.created_at = '2026-11-17T10:00:00.000Z';
  cRow.created_at = '2026-11-25T10:00:00.000Z';
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));

  // Approve current (25 Nov) FIRST
  reviewsStore.moderateReview({ id: current.review.id, action: 'APPROVE', adminId: 'admin', reason: 'Approved first' });
  // Approve earlier (17 Nov) AFTER
  reviewsStore.moderateReview({ id: earlier.review.id, action: 'APPROVE', adminId: 'admin', reason: 'Approved later' });

  const pub = reviewsStore.getPublicReviews({ limit: 10, sort: 'chronological' });
  const dates = pub.reviews.map(r => new Date(r.created_at).getTime());
  for (let i = 1; i < dates.length; i++) {
    assert.ok(dates[i - 1] <= dates[i], 'Public queue must be sorted earliest to latest left-to-right');
  }
  const idxEarly = pub.reviews.findIndex(r => r.id === earlier.review.id);
  const idxCurrent = pub.reviews.findIndex(r => r.id === current.review.id);
  assert.ok(idxEarly < idxCurrent, 'Earlier review (17 Nov) must automatically appear left of current review (25 Nov)');
});
