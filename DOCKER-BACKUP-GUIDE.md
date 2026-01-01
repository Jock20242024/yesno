# 使用 Docker 备份数据库指南

**创建日期**: 2025-01-30

---

## 🚀 快速执行

### 方法 1: 使用备份脚本（推荐）

```bash
# 直接执行备份脚本
bash scripts/backup-database-docker.sh
```

脚本会自动：
- 检查 Docker 是否安装
- 从 `.env.production` 加载 `DATABASE_URL`
- 使用 Docker 执行备份
- 压缩并保存备份文件

---

### 方法 2: 手动执行

```bash
# 1. 加载环境变量
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 2. 创建备份目录
mkdir -p backups

# 3. 使用 Docker 执行备份
docker run --rm postgres:15-alpine pg_dump "$DATABASE_URL" | gzip > backups/yesno_db_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## ✅ 验证备份

```bash
# 检查备份文件
ls -lh backups/*.sql.gz

# 查看最新备份
ls -t backups/*.sql.gz | head -1
```

---

## 🔧 故障排除

### 问题 1: Docker 未安装

**解决方案**:
- 安装 Docker Desktop: https://www.docker.com/products/docker-desktop
- 或使用其他备份方案（见 `BACKUP-ALTERNATIVES.md`）

### 问题 2: Docker 服务未运行

**解决方案**:
- 启动 Docker Desktop 应用
- 等待 Docker 服务启动完成

### 问题 3: 数据库连接失败

**检查项**:
1. `DATABASE_URL` 是否正确
2. 数据库是否可访问
3. 网络连接是否正常

**测试连接**:
```bash
# 测试数据库连接
docker run --rm postgres:15-alpine psql "$DATABASE_URL" -c "SELECT version();"
```

### 问题 4: 权限错误

**解决方案**:
```bash
# 确保备份目录有写入权限
chmod 755 backups
```

---

## 📊 备份文件信息

备份文件保存位置: `backups/yesno_db_backup_YYYYMMDD_HHMMSS.sql.gz`

**文件格式**:
- 文件名: `yesno_db_backup_20250130_123456.sql.gz`
- 格式: gzip 压缩的 SQL 文件
- 大小: 根据数据库大小而定

---

## 🔄 恢复备份

如果需要恢复备份:

```bash
# 1. 解压备份文件
gunzip backups/yesno_db_backup_YYYYMMDD_HHMMSS.sql.gz

# 2. 恢复数据库
docker run --rm -i postgres:15-alpine psql "$DATABASE_URL" < backups/yesno_db_backup_YYYYMMDD_HHMMSS.sql
```

---

## ⚠️ 重要提示

1. **备份频率**: 建议每天至少备份一次
2. **备份存储**: 将备份文件存储在安全位置（不在项目目录中）
3. **备份验证**: 定期验证备份文件完整性
4. **保留策略**: 保留至少 30 天的备份

---

## 📝 下一步

备份完成后，可以继续执行生产部署：

```bash
# 加载环境变量
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 执行部署
npm install --production
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

---

**备份脚本**: `scripts/backup-database-docker.sh`  
**备份位置**: `backups/` 目录

