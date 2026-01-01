# 备份和部署完成指南

**创建日期**: 2025-01-30  
**状态**: 配置文件已准备就绪

---

## ✅ 已完成

1. ✅ **.env.production 文件已配置**
   - DATABASE_URL: 已配置
   - NEXTAUTH_URL: 已配置
   - NEXTAUTH_SECRET: 已配置
   - NODE_ENV: 已设置为 production

---

## 📋 需要完成的步骤

### 步骤 1: 备份数据库

由于 `pg_dump` 未安装，请选择以下方案之一：

#### 方案 A: 使用 Docker（推荐，如果已安装 Docker）

```bash
# 加载环境变量
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 执行备份（使用 Docker）
bash scripts/backup-database-docker.sh
```

#### 方案 B: 安装 PostgreSQL 客户端

```bash
# 安装 PostgreSQL（需要 Homebrew）
brew install postgresql@15

# 添加到 PATH（Apple Silicon Mac）
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# 或（Intel Mac）
export PATH="/usr/local/opt/postgresql@15/bin:$PATH"

# 执行备份
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)
bash scripts/backup-database.sh
```

#### 方案 C: 使用数据库托管服务的备份功能

如果使用云数据库服务（AWS RDS、Google Cloud SQL、Railway、Supabase 等），直接使用服务提供的备份功能。

---

### 步骤 2: 执行生产部署

备份完成后，执行以下命令：

```bash
# 1. 加载环境变量
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 2. 安装生产依赖
npm install --production

# 3. 运行数据库迁移
npx prisma migrate deploy

# 4. 生成 Prisma Client
npx prisma generate

# 5. 构建应用
npm run build

# 6. 启动应用
npm start
```

---

## 🔧 快速执行命令

### 完整部署流程（如果已安装 Docker）

```bash
# 1. 备份数据库
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)
bash scripts/backup-database-docker.sh

# 2. 部署应用
npm install --production
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

### 完整部署流程（如果已安装 PostgreSQL 客户端）

```bash
# 1. 备份数据库
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)
bash scripts/backup-database.sh

# 2. 部署应用
npm install --production
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

---

## 📊 验证步骤

部署完成后，执行以下验证：

1. **访问首页**
   ```bash
   curl https://your-domain.com
   ```
   - ✅ 应该返回 200 OK

2. **访问 API**
   ```bash
   curl https://your-domain.com/api/markets
   ```
   - ✅ 应该返回 JSON 数据

3. **检查日志**
   - ✅ 无错误日志
   - ✅ 无警告日志

---

## 📄 相关文档

- `BACKUP-ALTERNATIVES.md` - 备份替代方案详解
- `FINAL-DEPLOYMENT-GUIDE.md` - 完整部署指南
- `DEPLOYMENT-FINAL-REPORT.md` - 部署执行报告

---

## ⚠️ 重要提示

1. **备份必须在迁移前完成**
2. **确保所有环境变量已正确配置**
3. **验证数据库连接正常**
4. **保留备份文件至少 30 天**

---

**当前状态**: 配置已完成，等待执行备份和部署

