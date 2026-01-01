# 立即执行备份

**执行命令**:

```bash
bash scripts/backup-database-docker.sh
```

---

## 执行步骤

1. **打开终端**
2. **进入项目目录**
   ```bash
   cd /Users/npcventures/yesno-app
   ```
3. **执行备份脚本**
   ```bash
   bash scripts/backup-database-docker.sh
   ```

---

## 预期输出

如果成功，应该看到：

```
==========================================
使用 Docker 执行数据库备份
==========================================

数据库: postgresql:***
备份文件: backups/yesno_db_backup_YYYYMMDD_HHMMSS.sql.gz

开始备份（使用 Docker）...
✅ 备份成功!
备份文件: backups/yesno_db_backup_YYYYMMDD_HHMMSS.sql.gz
备份大小: XX MB
```

---

## 验证备份

备份完成后，检查备份文件：

```bash
# 查看备份文件
ls -lh backups/*.sql.gz

# 查看最新备份
ls -t backups/*.sql.gz | head -1
```

---

## 如果遇到问题

### 问题: Docker 未安装
```bash
# 安装 Docker Desktop
# 访问: https://www.docker.com/products/docker-desktop
```

### 问题: Docker 未运行
```bash
# 启动 Docker Desktop 应用
```

### 问题: 数据库连接失败
```bash
# 检查 DATABASE_URL
grep DATABASE_URL .env.production

# 测试连接
docker run --rm postgres:15-alpine psql "$DATABASE_URL" -c "SELECT 1;"
```

---

## 备份完成后

备份成功后，继续执行部署：

```bash
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)
npm install --production
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

---

**现在执行**: `bash scripts/backup-database-docker.sh`

