-- ============================================================
-- 身体档案 / 连线游戏 / 身体状态记录
-- ============================================================

-- 1) 连线游戏结果：记录用户建立的 7 种颜色 ↔ 7 个感受词 映射
CREATE TABLE IF NOT EXISTS color_word_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- 7 个颜色槽位（每个颜色对应一个词）
  red_word TEXT NOT NULL,
  orange_word TEXT NOT NULL,
  yellow_word TEXT NOT NULL,
  green_word TEXT NOT NULL,
  blue_word TEXT NOT NULL,
  indigo_word TEXT NOT NULL,
  purple_word TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) 身体状态记录：每次涂色提交的快照
CREATE TABLE IF NOT EXISTS body_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- JSON 格式：{ head: 'red', hand: 'yellow', ... }
  -- 键 = 身体部位名，值 = 颜色名（red/orange/yellow/green/blue/indigo/purple）
  -- 未涂色的部位不会出现在 JSON 中
  body_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 本次涂色最先涂的部位（用于故事弹窗的默认选项）
  first_part TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) 身体小故事：用户分享的具体叙述
CREATE TABLE IF NOT EXISTS body_stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  body_part TEXT NOT NULL,       -- 身体部位名
  color TEXT NOT NULL,           -- 对应的颜色
  word TEXT NOT NULL,            -- 颜色对应的词（来自连线结果）
  story TEXT NOT NULL,           -- 用户输入的小故事
  body_record_id UUID,           -- 关联的 body_records.id（可空）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引：按 user_id 查询历史
CREATE INDEX IF NOT EXISTS idx_color_word_links_user ON color_word_links(user_id);
CREATE INDEX IF NOT EXISTS idx_body_records_user ON body_records(user_id);
CREATE INDEX IF NOT EXISTS idx_body_stories_user ON body_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_body_stories_part_word ON body_stories(body_part, word);
