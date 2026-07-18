-- 迁移 color_word_links 表：从 color_key → word 改为 word → hex
-- 先删除旧列，再添加新列

ALTER TABLE color_word_links
  DROP COLUMN IF EXISTS red_word,
  DROP COLUMN IF EXISTS orange_word,
  DROP COLUMN IF EXISTS yellow_word,
  DROP COLUMN IF EXISTS green_word,
  DROP COLUMN IF EXISTS blue_word,
  DROP COLUMN IF EXISTS indigo_word,
  DROP COLUMN IF EXISTS purple_word;

ALTER TABLE color_word_links
  ADD COLUMN IF NOT EXISTS "word_疼痛" TEXT NOT NULL DEFAULT '#e2574c',
  ADD COLUMN IF NOT EXISTS "word_轻松" TEXT NOT NULL DEFAULT '#f5a623',
  ADD COLUMN IF NOT EXISTS "word_紧张" TEXT NOT NULL DEFAULT '#f8d347',
  ADD COLUMN IF NOT EXISTS "word_沉重" TEXT NOT NULL DEFAULT '#7ed321',
  ADD COLUMN IF NOT EXISTS "word_柔软" TEXT NOT NULL DEFAULT '#4a90d9',
  ADD COLUMN IF NOT EXISTS "word_控制" TEXT NOT NULL DEFAULT '#5d5fe8',
  ADD COLUMN IF NOT EXISTS "word_不自觉" TEXT NOT NULL DEFAULT '#a78bfa';
