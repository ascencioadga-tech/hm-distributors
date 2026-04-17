-- ═══════════════════════════════════════════════════════
--  HM Distributors — Supabase Database Schema
--  Run this in the Supabase SQL Editor (supabase.com → SQL)
-- ═══════════════════════════════════════════════════════

-- Recipients
CREATE TABLE recipients (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  company     TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL,
  selected    BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recipients" ON recipients
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Products
CREATE TABLE products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_key   TEXT NOT NULL,
  name        TEXT NOT NULL,
  theme       TEXT NOT NULL,
  cap_class   TEXT NOT NULL,
  header      TEXT DEFAULT '',
  subheader   TEXT DEFAULT '',
  sizes       JSONB NOT NULL DEFAULT '[]',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own products" ON products
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Quotes (history — both sent and draft)
CREATE TABLE quotes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date_label      TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('draft','sent')),
  price_count     INTEGER DEFAULT 0,
  total_products  INTEGER DEFAULT 0,
  recipient_count INTEGER DEFAULT 0,
  recipient_names TEXT[] DEFAULT '{}',
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quotes" ON quotes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Current Draft (one per user)
CREATE TABLE current_draft (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE current_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own draft" ON current_draft
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Last Sent Quote (one per user)
CREATE TABLE last_sent (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}',
  sent_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE last_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own last_sent" ON last_sent
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Preferences (one per user)
CREATE TABLE preferences (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  company     TEXT DEFAULT 'HM Distributors Inc.',
  subject     TEXT DEFAULT 'HM Distributors — Daily Quote Sheet',
  autosave    BOOLEAN DEFAULT true,
  fob         TEXT DEFAULT 'Nogales, AZ',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
