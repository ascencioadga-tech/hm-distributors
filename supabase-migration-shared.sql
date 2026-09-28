-- ═══════════════════════════════════════════════════════
--  HM Distributors — shared company data + multiple users
--  Run once in the Supabase SQL Editor (supabase.com → SQL)
--
--  Before: every user had their own private recipients, products
--  and history. After: all HM users share one customer list, one
--  product catalog and one quote history. Drafts and preferences
--  stay personal. Each row still records who wrote it (user_id).
-- ═══════════════════════════════════════════════════════

-- Recipients: one company list, one row per email
DROP POLICY IF EXISTS "Users manage own recipients" ON recipients;
ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_user_id_email_key;
CREATE POLICY "HM users read recipients" ON recipients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "HM users write recipients" ON recipients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HM users change recipients" ON recipients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HM users remove recipients" ON recipients
  FOR DELETE TO authenticated USING (true);

-- Products: one company catalog
DROP POLICY IF EXISTS "Users manage own products" ON products;
CREATE POLICY "HM users read products" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "HM users write products" ON products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HM users change products" ON products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HM users remove products" ON products
  FOR DELETE TO authenticated USING (true);

-- Quotes: shared history, with who sent each one
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_by TEXT;
DROP POLICY IF EXISTS "Users manage own quotes" ON quotes;
CREATE POLICY "HM users read quotes" ON quotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "HM users write quotes" ON quotes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HM users change quotes" ON quotes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HM users remove quotes" ON quotes
  FOR DELETE TO authenticated USING (true);

-- Last sent: everyone can see the company's latest, each writes their own
DROP POLICY IF EXISTS "Users manage own last_sent" ON last_sent;
CREATE POLICY "HM users read last_sent" ON last_sent
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "HM users write own last_sent" ON last_sent
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HM users update own last_sent" ON last_sent
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HM users delete own last_sent" ON last_sent
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- current_draft and preferences stay personal (existing policies unchanged)
