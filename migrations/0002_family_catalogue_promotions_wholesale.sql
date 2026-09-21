PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN is_unisex INTEGER NOT NULL DEFAULT 0 CHECK (is_unisex IN (0, 1));

CREATE TABLE product_audiences (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('women', 'men', 'kids')),
  PRIMARY KEY (product_id, audience)
);

CREATE INDEX idx_product_audiences_audience ON product_audiences(audience, product_id);

CREATE TABLE category_audiences (
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('women', 'men', 'kids')),
  PRIMARY KEY (category_id, audience)
);

CREATE INDEX idx_category_audiences_audience ON category_audiences(audience, category_id);

INSERT OR IGNORE INTO product_audiences (product_id, audience)
SELECT id, 'women' FROM products;

INSERT OR IGNORE INTO categories (id, name, slug, active, display_order, created_at, updated_at) VALUES
  ('cat_shirts', 'Shirts', 'shirts', 1, 90, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_t_shirts', 'T-shirts', 't-shirts', 1, 100, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_polo_shirts', 'Polo Shirts', 'polo-shirts', 1, 110, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_trousers', 'Trousers', 'trousers', 1, 120, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_shorts', 'Shorts', 'shorts', 1, 130, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_jackets', 'Jackets', 'jackets', 1, 140, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_dresses', 'Dresses', 'dresses', 1, 150, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_tops', 'Tops', 'tops', 1, 160, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('cat_skirts', 'Skirts', 'skirts', 1, 170, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z');

INSERT OR IGNORE INTO category_audiences (category_id, audience) VALUES
  ('cat_mini_skirts', 'women'),
  ('cat_maxi_skirts', 'women'),
  ('cat_sleeveless_tops', 'women'),
  ('cat_crop_tops', 'women'),
  ('cat_two_piece_sets', 'women'),
  ('cat_jeans', 'women'),
  ('cat_gowns', 'women'),
  ('cat_jumpsuits', 'women'),
  ('cat_shirts', 'men'),
  ('cat_t_shirts', 'men'),
  ('cat_polo_shirts', 'men'),
  ('cat_trousers', 'men'),
  ('cat_jeans', 'men'),
  ('cat_shorts', 'men'),
  ('cat_two_piece_sets', 'men'),
  ('cat_jackets', 'men'),
  ('cat_dresses', 'kids'),
  ('cat_tops', 'kids'),
  ('cat_t_shirts', 'kids'),
  ('cat_two_piece_sets', 'kids'),
  ('cat_trousers', 'kids'),
  ('cat_jeans', 'kids'),
  ('cat_shorts', 'kids'),
  ('cat_skirts', 'kids');

CREATE TABLE wholesale_packages (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  condition_scope TEXT NOT NULL CHECK (condition_scope IN ('new', 'thrifted', 'mixed')),
  piece_count INTEGER NOT NULL CHECK (piece_count > 0 AND piece_count <= 10000),
  price_kobo INTEGER NOT NULL CHECK (price_kobo > 0),
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0 AND stock_quantity <= 999),
  state TEXT NOT NULL DEFAULT 'available' CHECK (state IN ('available', 'sold', 'hidden')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  published_at TEXT,
  sold_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (state != 'sold' OR sold_at IS NOT NULL)
);

CREATE INDEX idx_wholesale_public ON wholesale_packages(published, state, sold_at);
CREATE INDEX idx_wholesale_published ON wholesale_packages(published_at DESC);
CREATE INDEX idx_wholesale_updated ON wholesale_packages(updated_at DESC);

CREATE TABLE wholesale_package_audiences (
  package_id TEXT NOT NULL REFERENCES wholesale_packages(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('women', 'men', 'kids')),
  PRIMARY KEY (package_id, audience)
);

CREATE INDEX idx_wholesale_audiences_audience ON wholesale_package_audiences(audience, package_id);

CREATE TABLE wholesale_package_categories (
  package_id TEXT NOT NULL REFERENCES wholesale_packages(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (package_id, category_id)
);

CREATE INDEX idx_wholesale_categories_category ON wholesale_package_categories(category_id, package_id);

CREATE TABLE wholesale_package_images (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES wholesale_packages(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_wholesale_images_order ON wholesale_package_images(package_id, display_order, id);

CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_quantity INTEGER NOT NULL CHECK (required_quantity >= 2 AND required_quantity <= 100),
  discount_basis_points INTEGER NOT NULL CHECK (discount_basis_points >= 1 AND discount_basis_points <= 9900),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_at > start_at)
);

CREATE INDEX idx_promotions_active ON promotions(paused, start_at, end_at);

CREATE TABLE promotion_products (
  promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

CREATE INDEX idx_promotion_products_product ON promotion_products(product_id, promotion_id);

CREATE TABLE promotion_wholesale_packages (
  promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES wholesale_packages(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, package_id)
);

CREATE INDEX idx_promotion_wholesale_package ON promotion_wholesale_packages(package_id, promotion_id);

CREATE TABLE site_settings (
  id TEXT PRIMARY KEY CHECK (id = 'store'),
  logo_object_key TEXT,
  logo_content_type TEXT CHECK (logo_content_type IS NULL OR logo_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  logo_alt TEXT NOT NULL DEFAULT 'Joygiver Collections logo',
  hero_object_key TEXT,
  hero_content_type TEXT CHECK (hero_content_type IS NULL OR hero_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  hero_alt TEXT NOT NULL DEFAULT 'A coordinated collection of clothing for Women, Men, and Kids',
  hero_heading TEXT NOT NULL,
  hero_copy TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO site_settings (
  id, hero_heading, hero_copy, updated_at
) VALUES (
  'store',
  'Style for every story.',
  'Discover new and thrifted fashion for Women, Men, and Kids, curated in Abuja and delivered nationwide.',
  '2026-09-21T00:00:00.000Z'
);
