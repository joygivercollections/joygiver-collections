PRAGMA foreign_keys = ON;

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE login_attempts (
  attempt_key TEXT PRIMARY KEY,
  window_started TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_kobo INTEGER NOT NULL CHECK (price_kobo > 0),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'thrifted')),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  sizes_json TEXT NOT NULL CHECK (json_valid(sizes_json)),
  tags_json TEXT NOT NULL CHECK (json_valid(tags_json)),
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0 AND stock_quantity <= 999),
  state TEXT NOT NULL DEFAULT 'available' CHECK (state IN ('available', 'sold', 'hidden')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  published_at TEXT,
  sold_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (condition != 'thrifted' OR stock_quantity <= 1),
  CHECK (state != 'sold' OR sold_at IS NOT NULL)
);

CREATE INDEX idx_products_public ON products(published, state, sold_at);
CREATE INDEX idx_products_condition_published ON products(condition, published_at DESC);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_updated ON products(updated_at DESC);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_product_images_order ON product_images(product_id, display_order, id);

INSERT INTO categories (id, name, slug, active, display_order, created_at, updated_at) VALUES
  ('cat_mini_skirts', 'Mini Skirts', 'mini-skirts', 1, 10, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_maxi_skirts', 'Maxi Skirts', 'maxi-skirts', 1, 20, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_sleeveless_tops', 'Sleeveless Tops', 'sleeveless-tops', 1, 30, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_crop_tops', 'Crop Tops', 'crop-tops', 1, 40, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_two_piece_sets', 'Two-piece Sets', 'two-piece-sets', 1, 50, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_jeans', 'Jeans', 'jeans', 1, 60, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_gowns', 'Gowns', 'gowns', 1, 70, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('cat_jumpsuits', 'Jumpsuits', 'jumpsuits', 1, 80, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z');
