# 数据库设置指南

## 快速开始

### 1. 启动 PostgreSQL 数据库

#### 选项 A: 使用 Docker（推荐）

```bash
# 启动 PostgreSQL 容器
docker run --name yesno-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=yesno_db \
  -p 5432:5432 \
  -d postgres:15

# 如果容器已存在，启动它
docker start yesno-postgres
```

#### 选项 B: 使用 Homebrew（macOS）

```bash
# 安装 PostgreSQL
brew install postgresql@15

# 启动服务
brew services start postgresql@15

# 创建数据库
createdb yesno_db
```

#### 选项 C: 使用系统服务（Linux）

```bash
# 启动 PostgreSQL 服务
sudo service postgresql start

# 创建数据库
sudo -u postgres createdb yesno_db
```

### 2. 配置环境变量

确保 `.env.local` 文件存在并包含：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"
```

### 3. 运行数据库迁移

```bash
# 运行迁移
npx prisma migrate dev --name init_base_schema

# 生成 Prisma 客户端
npx prisma generate
```

### 4. 验证数据库连接

```bash
# 使用提供的脚本检查
./scripts/check-database.sh

# 或手动检查
psql postgresql://postgres:postgres@localhost:5432/yesno_db -c "SELECT version();"
```

## 数据库结构

迁移将创建以下表：

- `users` - 用户表
- `markets` - 市场表
- `orders` - 订单表
- `deposits` - 充值记录表
- `withdrawals` - 提现记录表
- `admin_logs` - 管理员操作日志表

## 测试数据

迁移完成后，数据库将是空的。你可以：

1. 通过前端注册新用户
2. 通过 Admin 后台创建市场
3. 通过 API 创建测试数据

## 故障排除

### 错误：Can't reach database server

**解决方案：**
- 检查 PostgreSQL 服务是否运行：`docker ps` 或 `brew services list`
- 检查端口 5432 是否被占用：`lsof -i :5432`
- 验证连接字符串是否正确

### 错误：database "yesno_db" does not exist

**解决方案：**
```bash
# 创建数据库
createdb yesno_db

# 或使用 Docker
docker exec -it yesno-postgres psql -U postgres -c "CREATE DATABASE yesno_db;"
```

### 错误：relation "users" already exists

**解决方案：**
```bash
# 重置数据库（警告：会删除所有数据）
npx prisma migrate reset

# 或手动删除表
psql postgresql://postgres:postgres@localhost:5432/yesno_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

