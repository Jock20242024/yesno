-- 创建 system_settings 表用于存储全局配置和心跳状态
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 添加注释
COMMENT ON TABLE system_settings IS '系统设置表（用于存储全局配置和状态）';
COMMENT ON COLUMN system_settings.key IS '设置键名';
COMMENT ON COLUMN system_settings.value IS '设置值（JSON字符串或纯文本）';
COMMENT ON COLUMN system_settings."updatedAt" IS '最后更新时间';

