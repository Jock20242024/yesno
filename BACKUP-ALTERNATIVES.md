# 数据库备份替代方案

**创建日期**: 2025-01-30  
**用途**: 当 pg_dump 不可用时的备份方案

---

## 🔍 当前状态

- ❌ `pg_dump` 未安装
- ❌ Homebrew 未安装（或不在 PATH 中）

---

## 💡 备份方案

### 方案 1: 安装 PostgreSQL 客户端工具

#### 选项 A: 使用 Homebrew（推荐）

```bash
# 1. 安装 Homebrew（如果未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装 PostgreSQL
brew install postgresql@15

# 3. 添加到 PATH（如果是 Apple Silicon Mac）
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# 或（如果是 Intel Mac）
export PATH="/usr/local/opt/postgresql@15/bin:$PATH"

# 4. 验证安装
pg_dump --version

# 5. 执行备份
export $(grep -v '^#' .env.production | xargs)
bash scripts/backup-database.sh
```

#### 选项 B: 使用 Docker

```bash
# 1. 使用 Docker 运行 pg_dump
docker run --rm -e PGPASSWORD=$(echo $DATABASE_URL | grep -oP ':[^:@]+@' | sed 's/[^@]*@//' | cut -d: -f1) \
  postgres:15-alpine pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 压缩备份
gzip backup_*.sql
```

#### 选项 C: 下载 PostgreSQL 客户端（不安装完整 PostgreSQL）

```bash
# macOS - 下载 PostgreSQL 应用
# 访问: https://postgresapp.com/
# 或使用: https://www.postgresql.org/download/macosx/
```

---

### 方案 2: 使用数据库托管服务的备份功能

如果使用云数据库服务，可以使用其内置的备份功能：

#### AWS RDS
```bash
# 使用 AWS CLI 创建快照
aws rds create-db-snapshot \
  --db-instance-identifier your-instance \
  --db-snapshot-identifier manual-snapshot-$(date +%Y%m%d)
```

#### Google Cloud SQL
```bash
# 使用 gcloud CLI 创建备份
gcloud sql backups create \
  --instance=your-instance \
  --description="Manual backup $(date +%Y%m%d)"
```

#### Railway / Render / Supabase
- 使用服务提供的控制台界面创建备份
- 或使用服务提供的 CLI 工具

---

### 方案 3: 使用 Prisma Studio 导出数据（仅用于小数据库）

```bash
# 1. 启动 Prisma Studio
npx prisma studio

# 2. 手动导出数据（不推荐用于生产环境）
```

---

### 方案 4: 使用数据库客户端工具

使用图形化数据库客户端工具（如 DBeaver、pgAdmin、TablePlus）：
1. 连接到数据库
2. 使用工具的导出功能
3. 保存为 SQL 文件

---

## 🚀 推荐的快速解决方案

### 如果使用 Docker

```bash
# 加载环境变量
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 使用 Docker 执行备份
docker run --rm \
  -e PGPASSWORD=$(echo $DATABASE_URL | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/') \
  postgres:15-alpine \
  pg_dump "$DATABASE_URL" | gzip > backups/yesno_db_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 如果使用数据库托管服务

直接使用服务提供的备份功能，通常更可靠且自动化。

---

## ⚠️ 重要提示

1. **备份必须在迁移前完成**
2. **备份文件存储在安全位置**
3. **定期验证备份完整性**
4. **保留至少 30 天的备份**

---

## 📝 验证备份

```bash
# 验证备份文件存在
ls -lh backups/*.sql.gz

# 验证备份文件完整性（解压测试）
gunzip -t backups/yesno_db_backup_*.sql.gz
```

---

**建议**: 选择最适合您环境的方案。如果使用云数据库服务，推荐使用服务的备份功能。

