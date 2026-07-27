-- 脊兽躲猫猫：对决事件表
-- 玩家在对决中输入对方的身份咒语即产生一条事件，
-- 目标玩家轮询本表判定续命（喜欢）或 game over（不喜欢）

CREATE TABLE IF NOT EXISTS hide_seek_duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_key TEXT NOT NULL,
  attacker_name TEXT NOT NULL DEFAULT '',
  attacker_beast TEXT NOT NULL DEFAULT '',
  target_spell TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hide_seek_duels_target
  ON hide_seek_duels (target_spell, created_at DESC);

ALTER TABLE hide_seek_duels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hide_seek_duels_select" ON hide_seek_duels;
CREATE POLICY "hide_seek_duels_select" ON hide_seek_duels
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hide_seek_duels_insert" ON hide_seek_duels;
CREATE POLICY "hide_seek_duels_insert" ON hide_seek_duels
  FOR INSERT WITH CHECK (true);
