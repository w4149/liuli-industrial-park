-- 用户声音标记表
CREATE TABLE IF NOT EXISTS audio_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_nickname TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  coordinate JSONB NOT NULL,
  audio_url TEXT NOT NULL,
  audio_name TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 飞鸽传书表
CREATE TABLE IF NOT EXISTS pigeon_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  content TEXT NOT NULL,
  stamp_url TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#667eea',
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_audio_markers_zone_name ON audio_markers(zone_name);
CREATE INDEX IF NOT EXISTS idx_audio_markers_user_id ON audio_markers(user_id);
CREATE INDEX IF NOT EXISTS idx_pigeon_letters_is_draft ON pigeon_letters(is_draft);

-- RLS（公开读写，与现有表策略一致）
ALTER TABLE audio_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pigeon_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to audio_markers" ON audio_markers;
DROP POLICY IF EXISTS "Allow authenticated insert for audio_markers" ON audio_markers;

DROP POLICY IF EXISTS "Allow public read access to pigeon_letters" ON pigeon_letters;
DROP POLICY IF EXISTS "Allow authenticated insert for pigeon_letters" ON pigeon_letters;
DROP POLICY IF EXISTS "Allow authenticated update for pigeon_letters" ON pigeon_letters;

CREATE POLICY "Allow public read access to audio_markers" ON audio_markers
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for audio_markers" ON audio_markers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to pigeon_letters" ON pigeon_letters
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for pigeon_letters" ON pigeon_letters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update for pigeon_letters" ON pigeon_letters
  FOR UPDATE USING (true);
