# DATABASE_URL 修复指南

## 🔍 问题诊断

当前的 DATABASE_URL 格式存在问题，导致 Prisma 无法连接数据库。

## 📋 检查步骤

### 1. 检查当前值

```bash
grep "^DATABASE_URL" .env.production
```

### 2. 确认是否为占位符

如果 DATABASE_URL 包含 `user:password@host:port` 这样的占位符文本，需要替换为真实的数据库连接信息。

### 3. 正确的格式

DATABASE_URL 的正确格式应该是：

```
DATABASE_URL=postgresql://用户名:密码@主机地址:端口号/数据库名?schema=public
```

**示例**:
```
DATABASE_URL=postgresql://myuser:mypass@localhost:5432/mydb?schema=public
```

## 🔧 修复步骤

### 步骤 1: 获取真实的数据库连接信息

你需要知道：
- **用户名** (username)
- **密码** (password)
- **主机地址** (host，例如: localhost 或数据库服务器 IP)
- **端口号** (port，PostgreSQL 默认是 5432)
- **数据库名** (database name)

### 步骤 2: 处理特殊字符

如果密码中包含特殊字符，需要进行 URL 编码：

| 字符 | 编码 |
|------|------|
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `#` | `%23` |
| `?` | `%3F` |
| `&` | `%26` |
| `%` | `%25` |
| `+` | `%2B` |
| `=` | `%3D` |
| ` ` (空格) | `%20` |

**示例**:
如果密码是 `p@ssw:rd`，需要编码为 `p%40ssw%3Ard`

### 步骤 3: 更新 .env.production

编辑 `.env.production` 文件，设置正确的 DATABASE_URL：

```bash
nano .env.production
# 或使用你喜欢的编辑器
```

确保格式为：
```
DATABASE_URL=postgresql://username:password@host:port/database?schema=public
```

**不要使用引号！**

### 步骤 4: 测试连接

```bash
# 加载环境变量
export $(grep -v '^#' .env.production | xargs)

# 测试 Prisma 连接
npx prisma db pull --force
```

如果成功，会显示数据库结构。

### 步骤 5: 执行迁移

```bash
export NODE_ENV=production
npx prisma migrate deploy
```

## 🐳 如果是 Docker 数据库

如果你使用 Docker 运行 PostgreSQL：

```bash
# 查找运行的容器
docker ps | grep postgres

# 查看容器详细信息
docker inspect <container_id>
```

Docker 环境的 DATABASE_URL 通常是：
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/dbname?schema=public
```

## ⚠️ 常见错误

1. **端口号无效**
   - 确保端口号是数字（1-65535）
   - 确保端口号在 `@` 和 `/` 之间

2. **特殊字符未编码**
   - 密码中的特殊字符必须 URL 编码

3. **使用引号**
   - DATABASE_URL 不应该用引号包裹
   - 错误: `DATABASE_URL="postgresql://..."`
   - 正确: `DATABASE_URL=postgresql://...`

4. **占位符未替换**
   - 确保使用真实的数据库连接信息

## 📞 需要帮助？

如果仍有问题，请提供：
1. DATABASE_URL 的前几个字符（隐藏敏感信息）
2. 错误消息的完整内容
3. 你使用的数据库类型和连接方式（本地、Docker、云服务等）

