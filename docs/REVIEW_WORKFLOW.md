# Dear Misu — Customer Review Management & Authenticity Workflow

This document explains the end-to-end architecture, moderation rules, independent purchase verification, strict review integrity, and testing procedures for the Dear Misu Review System.

## Core Principle

**Moderate content. Verify purchases. Never manipulate customer opinions.**

- **Admin moderation** (`PENDING`, `APPROVED`, `REJECTED`, `HIDDEN`) and **purchase verification** (`VERIFIED_PURCHASE`, `UNVERIFIED`) are strictly independent processes.
- Approving a review **never** automatically marks it as a Verified Purchase.
- Administrators **cannot** alter a customer's original review text, overall rating, category ratings, recommendation response, or submission timestamp.

---

## 1. Customer Review Submission & Verification Flow

1. A customer visits `/review` to submit feedback:
   - Selects product (`Dear Misu Mini`, `Dear Misu Classic`, or `Dear Misu Share Box`).
   - Chooses an overall 1–5 star rating (category ratings and recommendations are strictly optional and never auto-populated).
   - Enters display name, written review (`10–1000` chars), and optionally provides an **Order Reference** (e.g. `DEAR-1001`) + **Order Mobile Number** / **Email** for purchase verification.
2. `POST /api/reviews` runs server-side validation, rate limiting, HTML tag stripping, and spam/gibberish detection:
   - Any client-submitted `verifiedPurchase`, `purchaseVerified`, or `status` flags are ignored.
   - Server runs `findMatchingDeliveredOrder` against `orders` / `order_items`.
   - A review becomes `VERIFIED_PURCHASE` **only** when:
     - A valid order exists matching the customer's identity (`phone` or `email` + `orderRef` when supplied),
     - The order contains the reviewed product,
     - The order has reached `delivered` status, and
     - No prior review exists for that `(order_id, product_name)`.
3. Newly submitted reviews start with `status = 'PENDING'` and issue a one-time **private edit token** (`/review?edit=<id>&token=<token>`).

---

## 2. Customer Edit Workflow (Versioned)

- Customers can update their own reviews via `/review?edit=<id>&token=<token>` (`GET`/`PATCH /api/reviews/[id]`).
- Edits require a timing-safe SHA-256 verification of the review's private edit token.
- Each edit saves the previous snapshot in `review_versions`, logs a `CUSTOMER_EDITED` event in `review_audit_logs`, preserves verified purchase evidence, and moves the edited review back to `PENDING` for safety moderation before re-publication.

---

## 3. Admin Moderation & Audit Trail (`/admin/reviews`)

- **Authentication**: Secured via HMAC-signed session tokens (`src/lib/adminAuth.js`) with login rate limiting.
- **Dashboard Metrics**: Computed live from stored records (`total`, `pending`, `approved`, `rejectedOrHidden`, `averageRating` from published reviews only, `recommendationPercentage` only from explicit Yes/No/Maybe responses).
- **Moderation Actions**:
  - `APPROVE` (`PATCH /api/admin/reviews/[id]/approve`): Publishes a review (`APPROVED`) without altering ratings, text, or purchase verification status.
  - `REJECT` (`PATCH /api/admin/reviews/[id]/reject`): Excludes a review from public view; **requires an internal reason**.
  - `HIDE` (`PATCH /api/admin/reviews/[id]/hide`): Temporarily removes an `APPROVED` review (`HIDDEN`); preserves original content & history; **requires an internal reason**.
  - `RESTORE` (`PATCH /api/admin/reviews/[id]/restore`): Restores a `HIDDEN` or `REJECTED` review back to `APPROVED`.
  - `DELETE` (`DELETE /api/admin/reviews/[id]`): Allowed **only** for `duplicate`, `privacy_erasure`, `legal_compliance`, or `spam_fraud` (blocked for genuine verified-purchase negative reviews marked as spam) and requires justification.
  - `PATCH /api/admin/reviews/[id]` returns `403 Forbidden` to enforce read-only customer opinions.
- **Audit Log**: Every action is appended to `review_audit_logs` (`GET /api/admin/reviews/audit` and per-review details drawer).

---

## 4. Public Website & Review Policy

- Public queries (`GET /api/reviews`, `GET /api/reviews/stats`) return **only** `APPROVED` reviews and strip all private customer fields (`customer_email`, `customer_phone`, `order_id`, `order_ref`, `verification_evidence`, `moderation_reason`).
- Default ordering is **Newest First**, with filters for product, star rating, and **Verified Purchases Only**.
- Verified purchases display **Verified Purchase** with explanation *"This review is linked to a completed order for this product."* Unverified reviews display **Customer Review**.
- Public transparency policy is available at `/review-policy`.
