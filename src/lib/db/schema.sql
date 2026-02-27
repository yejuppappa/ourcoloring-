-- OurColoring Gallery Database Schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ko TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ko TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(category_id, slug)
);

CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  subcategory_id TEXT NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ko TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
  age_min INTEGER NOT NULL DEFAULT 3,
  age_max INTEGER NOT NULL DEFAULT 10,
  image_key TEXT NOT NULL,
  thumbnail_key TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subcategory_id, slug)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_drawings_subcategory ON drawings(subcategory_id, is_published);
CREATE INDEX IF NOT EXISTS idx_drawings_published ON drawings(is_published, download_count DESC);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
