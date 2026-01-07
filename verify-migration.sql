-- 验证 ammK 和 initialLiquidity 字段是否已成功添加
-- 在 Supabase SQL 编辑器中执行此查询

SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'markets' 
AND column_name IN ('ammK', 'initialLiquidity')
ORDER BY column_name;

-- 如果查询返回两行结果，说明字段已成功添加：
-- ammK | double precision | YES
-- initialLiquidity | double precision | YES

