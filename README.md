# TiraMio Tiramisu — Storefront

A responsive, premium dessert storefront for the TiraMio brand.

**Brand identity**
- Brand: TiraMio Tiramisu
- Tagline: Layers of Love, in Every Bite.
- Palette: espresso brown, mascarpone cream, cocoa, and muted gold
- Confirmed contact: WhatsApp `8433198122`
- Menu: 100 g — ₹69 · 200 g — ₹129 · 300 g — ₹189

## Opening hero film and menu visuals

- The supplied 8-second Google Flow MP4 plays **muted, automatically, and continuously in a loop** as the full-bleed background of the opening hero. The source file has no audio stream; the player also sets `muted`, `defaultMuted`, `loop`, and `playsInline`.
- The hero keeps a separate foreground dessert photograph and a dark responsive overlay so the headline, tagline, and order actions remain legible over every video frame.
- Mini, Classic, and Share Box use separate animated WebP open-box visuals. CSS scales the open-box artwork progressively from Mini to Classic to Share Box without cropping the packaging.
- The menu communicates value using the confirmed weights/prices: Mini ₹69/100 g, Classic ₹64.50/100 g, and Share Box ₹63/100 g. Classic highlights ₹9 saved versus two Mini boxes; Share Box highlights ₹18 saved versus three Mini boxes.
- Reduced-motion preferences replace the moving hero film with its poster fallback and stop the product-image float animation.


## What's included

- `preview/` — an interactive HTML/CSS/JS preview with a silent, continuously looping hero background film and three animated open-box product visuals. It works without installing packages and includes the responsive storefront, cart, WhatsApp order form, sample local tracking and order QR.
- `src/` — Next.js App Router frontend in JavaScript, with Motion scroll/entrance effects and the same brand design system.
- `backend/` — Express API for server-priced orders, phone-verified tracking, order-status updates and Razorpay payment order/signature verification.
- `database/schema.sql` — PostgreSQL schema and product seed data.
- `public/images/` — dessert photography, three curated TiraMio packaging stills, and a WhatsApp order QR. `public/videos/tiramio-scroll.mp4` — the supplied 8-second 1280×720 product film with its audio track removed.

## 1. Open the preview

From the project folder:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/preview/`.

The preview is deliberately independent from the API. It demonstrates the customer journey and opens WhatsApp with a pre-filled message. Its local order tracking is a browser-only demo, not live delivery data.

## 2. Run the Next.js frontend

Use Node.js 22 or a compatible current LTS release.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_API_URL` in `.env.local` to the deployed Express API URL. Keep secret keys out of all `NEXT_PUBLIC_*` variables.

## 3. Run the Express + PostgreSQL backend

Create a PostgreSQL database named `tiramio`, then:

```bash
cd backend
npm install
cp .env.example .env
```

Update `DATABASE_URL`, `CORS_ORIGINS`, and `ADMIN_STATUS_SECRET` in `backend/.env`. Apply the schema from the project root:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

Start the API:

```bash
cd backend
npm run dev
```

Health check: `GET http://localhost:4000/health`.

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/products` | Active catalogue |
| POST | `/api/orders` | Create order; server calculates price |
| GET | `/api/orders/:orderRef/track?phone=...` | Track by reference and customer phone |
| POST | `/api/payments/create-order` | Create Razorpay payment order |
| POST | `/api/payments/verify` | Verify Razorpay signature on the server |
| POST | `/api/payments/webhook` | Verify payment webhook signature and reconcile payment state |
| PATCH | `/api/admin/orders/:orderRef/status` | Update order stage using `x-admin-status-secret` |

Order statuses: `placed → confirmed → preparing → out_for_delivery → delivered` (or `cancelled`). Status changes are written to `order_status_events` for a durable tracking timeline.

## 4. Enable online payments

Create a Razorpay merchant account and test keys. Put these **only** in `backend/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Restart the API and test in Razorpay test mode before going live. The backend verifies the payment signature with an HMAC before marking an order as paid. Do not trust a client-side success callback by itself. Replace test credentials with live credentials only after the merchant account and website are approved.

## 5. Production launch checklist

Before accepting public orders, fill in these business details:

1. Actual business email (the previous design used a placeholder email, so this website intentionally does not publish it).
2. Confirm whether `@TiraMioTiramisu` is available and claim the matching social handle.
3. Pickup location, delivery service area, delivery fee, delivery slots and minimum order (if any).
4. Product ingredients, allergen statement, storage and best-before information based on the actual recipe and applicable food-label rules.
5. FSSAI registration/licence details and other required business disclosures, as applicable.
6. Razorpay merchant account, test/live keys, webhook secret/configuration and a deployed HTTPS domain.
7. Privacy policy, terms, refund/cancellation policy and customer support contact.

The QR in `public/images/order-qr.png` opens a WhatsApp conversation for `+91 8433198122`. Replace/regenerate it if the ordering destination changes. It does not collect payment itself.

### Add another dessert later

The production frontend loads the active catalogue from `GET /api/products`, and order validation accepts product slugs stored in PostgreSQL. To add another dessert, add its image under `public/images/`, then insert a row into `products` with a unique lowercase `slug`, `name`, `weight_grams`, `price_paise`, `short_description`, `badge`, `image_url`, and `sort_order`. The new item appears in the menu and box builder without hard-coding another product into the React page. Keep `price_paise` as the single source of truth; the API calculates the order total from database prices.

## Cinematic motion direction

- Google Flow provides the 8-second product film; the website plays the complete clip as a silent, looping hero background. It is not tied to scroll position.
- The open-box category visuals are animated WebP files and use CSS sizing/float motion to show Mini, Classic and Share Box at distinct visual scales.
- Motion for React handles component entrance and interaction states, with reduced-motion support.
- The frontend uses locally authored CSS design tokens and responsive component styles. No remote CSS framework or CDN is required; this keeps the custom art direction lightweight and avoids a framework migration that could affect existing ordering flows.

## Technical decisions

- **Next.js App Router** for the customer-facing website, route structure and metadata.
- **Express** as a separate API service to support future admin, delivery and mobile-app clients.
- **PostgreSQL** for orders, items, payments and status history, with database constraints and indexes.
- **Motion for React** for restrained entrance and interaction states, with reduced-motion support.
- **Locally authored CSS** for the responsive design system and art-directed layouts. This storefront already has custom CSS components; introducing Tailwind during this iteration would add a dependency without improving the product experience or browser compatibility. **Three.js is intentionally not required** for the first release: the Google Flow product film supplies the cinematic visual, while a full-time WebGL scene would add weight without helping customers choose and order quickly.

This repository is a build-ready starter, not a deployed production service. The standalone preview is usable now; live database tracking and Razorpay payments require the configuration steps above.
