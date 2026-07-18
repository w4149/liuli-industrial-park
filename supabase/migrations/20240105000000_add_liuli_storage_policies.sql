-- ============================================================
-- LIULI Storage 桶 policy（音频 + 图片）
-- 桶名: LIULI
-- 子目录: audio/  (声音花园上传的音频)
--         image/  (飞鸽传书上传的像素化邮票图)
-- 桶级上传大小限制: 1MB (在 Supabase 控制台设置)
-- ============================================================

-- 1) 公开读取：任何人可通过 public URL 访问桶内文件
--    (音频播放、邮票图片显示都依赖此权限)
DROP POLICY IF EXISTS "Allow public read access on LIULI bucket"
  ON storage.objects;

CREATE POLICY "Allow public read access on LIULI bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'LIULI');

-- 2) 允许匿名/已认证用户上传（INSERT）
--    本项目前端使用 anon key 调用 Storage，因此 policy 不能限定 auth.uid()
--    如需收紧，可改为: (bucket_id = 'LIULI' AND auth.role() = 'authenticated')
DROP POLICY IF EXISTS "Allow anon insert into LIULI bucket"
  ON storage.objects;

CREATE POLICY "Allow anon insert into LIULI bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'LIULI');

-- 3) 允许更新已有对象（用于 x-upsert 覆盖上传）
DROP POLICY IF EXISTS "Allow anon update on LIULI bucket"
  ON storage.objects;

CREATE POLICY "Allow anon update on LIULI bucket"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'LIULI');

-- 4) 允许删除（可选：后续如需清理旧文件）
DROP POLICY IF EXISTS "Allow anon delete on LIULI bucket"
  ON storage.objects;

CREATE POLICY "Allow anon delete on LIULI bucket"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'LIULI');
