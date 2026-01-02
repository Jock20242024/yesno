-- 直接修复数据源的 SQL 脚本
-- 如果代码初始化失败，可以手动执行此 SQL

-- 检查现有数据源
SELECT sourceName, status FROM data_sources ORDER BY sourceName;

-- 创建 Polymarket 数据源（如果不存在）
INSERT INTO data_sources (id, "sourceName", status, "itemsCount", multiplier, config, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  'Polymarket',
  'ACTIVE',
  0,
  1.0,
  '{"apiUrl":"https://gamma-api.polymarket.com/markets","defaultLimit":100}',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM data_sources WHERE "sourceName" = 'Polymarket'
);

-- 创建"全网数据"数据源（如果不存在）
INSERT INTO data_sources (id, "sourceName", status, "itemsCount", multiplier, config, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  '全网数据',
  'ACTIVE',
  0,
  1.0,
  '{"type":"global_stats","description":"全网统计数据采集源"}',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM data_sources WHERE "sourceName" = '全网数据'
);

-- 验证结果
SELECT sourceName, status, "itemsCount", multiplier FROM data_sources ORDER BY sourceName;
