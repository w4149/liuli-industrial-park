-- 脊兽躲猫猫：玩家实时位置共享表
-- 每个正在玩的用户一行（按 user_key 唯一），每分钟心跳更新一次坐标（GCJ02）
CREATE TABLE IF NOT EXISTS hide_seek_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL DEFAULT '神秘访客',
  beast_type TEXT NOT NULL DEFAULT '',
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hide_seek_presence_updated_at
  ON hide_seek_presence (updated_at);

ALTER TABLE hide_seek_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to hide_seek_presence" ON hide_seek_presence;
DROP POLICY IF EXISTS "Allow public insert for hide_seek_presence" ON hide_seek_presence;
DROP POLICY IF EXISTS "Allow public update for hide_seek_presence" ON hide_seek_presence;
DROP POLICY IF EXISTS "Allow public delete for hide_seek_presence" ON hide_seek_presence;

CREATE POLICY "Allow public read access to hide_seek_presence" ON hide_seek_presence
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert for hide_seek_presence" ON hide_seek_presence
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for hide_seek_presence" ON hide_seek_presence
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete for hide_seek_presence" ON hide_seek_presence
  FOR DELETE USING (true);
