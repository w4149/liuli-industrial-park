ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Allow authenticated insert for users" ON users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;

DROP POLICY IF EXISTS "Allow public read access to pois" ON pois;
DROP POLICY IF EXISTS "Allow authenticated insert for pois" ON pois;

DROP POLICY IF EXISTS "Allow public read access to inspiration_messages" ON inspiration_messages;
DROP POLICY IF EXISTS "Allow authenticated insert for inspiration_messages" ON inspiration_messages;
DROP POLICY IF EXISTS "Allow authenticated update for inspiration_messages" ON inspiration_messages;

DROP POLICY IF EXISTS "Allow public read access to badges" ON badges;
DROP POLICY IF EXISTS "Allow authenticated insert for badges" ON badges;

DROP POLICY IF EXISTS "Allow public read access to shop_items" ON shop_items;
DROP POLICY IF EXISTS "Allow authenticated update for shop_items" ON shop_items;

DROP POLICY IF EXISTS "Allow authenticated insert for user_visits" ON user_visits;
DROP POLICY IF EXISTS "Allow users to read their own visits" ON user_visits;

DROP POLICY IF EXISTS "Allow public read access to calibration_points" ON calibration_points;
DROP POLICY IF EXISTS "Allow authenticated insert for calibration_points" ON calibration_points;
DROP POLICY IF EXISTS "Allow authenticated delete for calibration_points" ON calibration_points;

CREATE POLICY "Allow public read access to users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow public read access to pois" ON pois
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for pois" ON pois
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to inspiration_messages" ON inspiration_messages
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for inspiration_messages" ON inspiration_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update for inspiration_messages" ON inspiration_messages
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to badges" ON badges
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for badges" ON badges
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to shop_items" ON shop_items
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated update for shop_items" ON shop_items
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated insert for user_visits" ON user_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to read their own visits" ON user_visits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow public read access to calibration_points" ON calibration_points
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for calibration_points" ON calibration_points
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for calibration_points" ON calibration_points
  FOR DELETE USING (true);