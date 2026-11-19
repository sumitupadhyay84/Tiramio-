CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sequential order counter for DEAR-0001, DEAR-0002, etc.
CREATE SEQUENCE IF NOT EXISTS order_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  weight_grams INTEGER NOT NULL CHECK (weight_grams > 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  short_description TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '/images/tiramisu-hero.jpg',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '/images/tiramisu-hero.jpg';

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('placed','confirmed','preparing','out_for_delivery','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid','pending','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone VARCHAR(10) NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  fulfilment TEXT NOT NULL CHECK (fulfilment IN ('Pickup','Delivery')),
  delivery_address TEXT,
  notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'Pay on pickup / delivery',
  upi_id TEXT,
  payment_id TEXT,
  status order_status NOT NULL DEFAULT 'placed',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fulfilment <> 'Delivery' OR delivery_address IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_events_order ON order_status_events(order_id, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  weight_grams INTEGER NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL,
  gateway_order_id TEXT UNIQUE NOT NULL,
  gateway_payment_id TEXT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_phone_created ON orders(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Migration helpers for existing databases
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Pay on pickup / delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;

INSERT INTO products (slug, name, weight_grams, price_paise, short_description, badge, image_url, sort_order)
VALUES
  ('mini', 'Dear Misu Mini', 100, 6900, 'Your personal pause. Just enough to make the day sweeter.', 'PERSONAL TREAT · SAVE ₹10', '/images/dearmisu-mini-card.webp', 1),
  ('classic', 'Dear Misu Classic', 200, 12900, 'The just-right box for your favourite dessert moment.', 'MOST LOVED · SAVE ₹11', '/images/dearmisu-classic-card.webp', 2),
  ('share', 'Dear Misu Share Box', 300, 18900, 'More layers, more spoons, more reasons to gather.', 'BEST VALUE · SAVE ₹21', '/images/dearmisu-share-card.webp', 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  weight_grams = EXCLUDED.weight_grams,
  price_paise = EXCLUDED.price_paise,
  short_description = EXCLUDED.short_description,
  badge = EXCLUDED.badge,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();


-- ============================================================
-- Customer Reviews
-- ============================================================
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  product_name TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  taste_rating SMALLINT CHECK (taste_rating BETWEEN 1 AND 5),
  creaminess_rating SMALLINT CHECK (creaminess_rating BETWEEN 1 AND 5),
  coffee_intensity_rating SMALLINT CHECK (coffee_intensity_rating BETWEEN 1 AND 5),
  sweetness_rating SMALLINT CHECK (sweetness_rating BETWEEN 1 AND 5),
  texture_rating SMALLINT CHECK (texture_rating BETWEEN 1 AND 5),
  chocolate_rating SMALLINT CHECK (chocolate_rating BETWEEN 1 AND 5),
  presentation_rating SMALLINT CHECK (presentation_rating BETWEEN 1 AND 5),
  sweetness_preference TEXT CHECK (sweetness_preference IN ('Too sweet','Just right','Less sweet')),
  coffee_preference TEXT CHECK (coffee_preference IN ('Mild','Balanced','Strong')),
  texture_preference TEXT CHECK (texture_preference IN ('Extra creamy','Soft and fluffy','Rich and layered','Perfectly balanced')),
  feedback_tags TEXT[] DEFAULT '{}',
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 10 AND 1000),
  customer_image_url TEXT,
  recommendation TEXT CHECK (recommendation IN ('Definitely!','Maybe','Not this time')),
  status review_status NOT NULL DEFAULT 'PENDING',
  verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_at TIMESTAMPTZ,
  moderated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON customer_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON customer_reviews(product_name);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON customer_reviews(overall_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON customer_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON customer_reviews(status, created_at DESC);

CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES customer_reviews(id) ON DELETE CASCADE,
  voter_ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, voter_ip_hash)
);
