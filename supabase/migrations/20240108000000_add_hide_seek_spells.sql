-- 脊兽躲猫猫：自定义咒语表
-- 仅开发者模式可增删，全部玩家客户端拉取后写入本地缓存使用；
-- 每轮重置（ROUND_RESET）只清使用次数与玩家状态，咒语本身跨轮次保留

CREATE TABLE IF NOT EXISTS hide_seek_spells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spell TEXT NOT NULL,
  type TEXT NOT NULL,
  beast TEXT NOT NULL DEFAULT '',
  minutes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hide_seek_spells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hide_seek_spells_select" ON hide_seek_spells;
CREATE POLICY "hide_seek_spells_select" ON hide_seek_spells
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hide_seek_spells_insert" ON hide_seek_spells;
CREATE POLICY "hide_seek_spells_insert" ON hide_seek_spells
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "hide_seek_spells_delete" ON hide_seek_spells;
CREATE POLICY "hide_seek_spells_delete" ON hide_seek_spells
  FOR DELETE USING (true);
