-- 脊兽躲猫猫：任务/提问系统表
-- 开发者模式发布问题 + 标准答案（answers 数组，任一命中即算答对，即"或"逻辑）+ 奖励咒语（名称 + 用法）
-- 全场第一个答对者独得奖励：completed_by_key 从空变为该玩家，任务即标记为"奖励已被获得"
-- 奖励咒语只在答对弹窗中揭晓一次，客户端不持久化保存，靠玩家自行记住

CREATE TABLE IF NOT EXISTS hide_seek_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  answers TEXT[] NOT NULL DEFAULT '{}',
  reward_spell TEXT NOT NULL,
  reward_usage TEXT NOT NULL DEFAULT '',
  completed_by_key TEXT NOT NULL DEFAULT '',
  completed_by_name TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hide_seek_tasks_created_at
  ON hide_seek_tasks (created_at DESC);

ALTER TABLE hide_seek_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hide_seek_tasks_select" ON hide_seek_tasks;
CREATE POLICY "hide_seek_tasks_select" ON hide_seek_tasks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hide_seek_tasks_insert" ON hide_seek_tasks;
CREATE POLICY "hide_seek_tasks_insert" ON hide_seek_tasks
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "hide_seek_tasks_update" ON hide_seek_tasks;
CREATE POLICY "hide_seek_tasks_update" ON hide_seek_tasks
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "hide_seek_tasks_delete" ON hide_seek_tasks;
CREATE POLICY "hide_seek_tasks_delete" ON hide_seek_tasks
  FOR DELETE USING (true);
