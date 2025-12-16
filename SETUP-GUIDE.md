# 数据库设置和功能验证指南

## 前置要求

1. **PostgreSQL 数据库**
   - 安装 Docker 或本地 PostgreSQL
   - 确保数据库服务正在运行

2. **Node.js 环境**
   - Node.js 18+ 
   - npm 或 yarn

## 快速开始

### 方法 1: 使用 Docker（推荐）

```bash
# 1. 启动 PostgreSQL 容器
docker run --name yesno-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=yesno_db \
  -p 5432:5432 \
  -d postgres:15-alpine

# 2. 运行数据库迁移
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
./scripts/run-migration.sh

# 3. 启动应用
./scripts/start-app.sh
```

### 方法 2: 使用本地 PostgreSQL

```bash
# 1. 确保 PostgreSQL 服务运行
# macOS: brew services start postgresql@15
# Linux: sudo service postgresql start

# 2. 创建数据库
createdb yesno_db

# 3. 运行迁移
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
./scripts/run-migration.sh

# 4. 启动应用
./scripts/start-app.sh
```

## 功能验证步骤

### 1. 环境验证

运行验证脚本检查所有依赖：

```bash
./scripts/verify-all.sh
```

### 2. 数据库迁移验证

```bash
# 检查数据库表
psql postgresql://postgres:postgres@localhost:5432/yesno_db -c "\dt"
```

应该看到以下表：
- users
- markets
- orders
- deposits
- withdrawals
- admin_logs
- _prisma_migrations

### 3. 手动功能测试

按照 `scripts/verify-features.md` 中的步骤逐一测试：

#### 场景 1: Admin 登录测试
- 访问 http://localhost:3000/admin/login
- 使用凭证：`admin@example.com` / `admin123`
- 验证是否跳转到 `/admin/dashboard`

#### 场景 2: 用户注册与充值
- 访问 http://localhost:3000/register
- 注册新用户：`usera@example.com` / `password123`
- 登录后访问 http://localhost:3000/profile
- 充值 $1000

#### 场景 3: 市场创建与下注
- Admin 登录，创建新市场 M1（费率 5%）
- 用户 A 对 M1 下注 YES $100
- 验证余额变为 $900

#### 场景 4: 提现请求
- 用户 A 提交提现 $500
- 验证余额变为 $400（资金锁定）

#### 场景 5: 市场清算
- Admin 将市场 M1 状态改为 CLOSED
- Admin 清算市场，选择 YES
- 验证用户余额计算（$400 + 收益）

#### 场景 6: 提现审批
- Admin 审批提现请求
- 验证余额保持不变

### 4. 数据库验证

使用 SQL 查询验证数据：

```sql
-- 查看用户
SELECT id, email, balance FROM users;

-- 查看市场
SELECT id, title, status, "totalVolume", "totalYes", "totalNo" FROM markets;

-- 查看订单
SELECT id, "userId", "marketId", "outcomeSelection", amount, payout FROM orders;

-- 查看充值记录
SELECT id, "userId", amount, status FROM deposits;

-- 查看提现记录
SELECT id, "userId", amount, status FROM withdrawals;
```

## 故障排除

### 问题 1: Docker 命令未找到

**解决方案：**
- 安装 Docker Desktop: https://www.docker.com/products/docker-desktop
- 或使用本地 PostgreSQL

### 问题 2: 数据库连接失败

**检查：**
```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgres
# 或
brew services list | grep postgresql
```

**解决：**
```bash
# Docker
docker start yesno-postgres

# Homebrew
brew services start postgresql@15
```

### 问题 3: Prisma 迁移失败

**检查：**
- 数据库是否已创建
- DATABASE_URL 是否正确
- 网络连接是否正常

**解决：**
```bash
# 重置迁移（警告：会删除所有数据）
npx prisma migrate reset

# 重新运行迁移
npx prisma migrate dev --name init_base_schema
```

### 问题 4: 应用启动失败

**检查：**
- Node.js 版本是否 >= 18
- node_modules 是否已安装
- 端口 3000 是否被占用

**解决：**
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 使用其他端口
PORT=3001 npm run dev
```

## 测试报告模板

完成测试后，记录结果：

```
测试日期: ___________
测试人员: ___________

场景 1 - Admin 登录: ✅ / ❌
场景 2 - 用户注册与充值: ✅ / ❌
场景 3 - 市场创建与下注: ✅ / ❌
场景 4 - 提现请求: ✅ / ❌
场景 5 - 市场清算: ✅ / ❌
场景 6 - 提现审批: ✅ / ❌

问题记录:
1. ___________
2. ___________
```

## 相关文档

- `E2E-TEST-REPORT.md` - 详细的端到端测试报告
- `scripts/verify-features.md` - 功能验证清单
- `README-DATABASE.md` - 数据库设置文档
- `FINAL-TEST-SUMMARY.md` - 最终测试总结
