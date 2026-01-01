# 最终部署指南

**创建日期**: 2025-01-30  
**状态**: ✅ 所有脚本和模板已准备就绪

---

## 🎯 快速开始

### 1. 测试环境验证

```bash
# 执行自动化验证脚本
bash scripts/verify-test-env.sh

# 查看验证结果
cat TEST-ENV-VERIFICATION-RESULT-*.md
```

### 2. 配置生产环境变量

```bash
# 1. 复制模板文件
cp env.production.template .env.production

# 2. 编辑环境变量（替换所有占位符）
nano .env.production

# 3. 验证必需变量已配置
grep -E "DATABASE_URL|NEXTAUTH_URL|NEXTAUTH_SECRET" .env.production
```

### 3. 测试数据库迁移

```bash
# 在测试环境测试迁移
bash scripts/test-migration.sh
```

### 4. 备份生产数据库

```bash
# 设置生产数据库 URL
export DATABASE_URL="your-production-database-url"

# 执行备份
bash scripts/backup-database.sh
```

### 5. 执行生产部署

```bash
# 执行部署脚本
bash scripts/deploy-production.sh

# 启动应用
npm start
```

---

## 📋 详细步骤

### 阶段 1: 测试环境验证

#### 1.1 执行验证脚本

```bash
bash scripts/verify-test-env.sh
```

**验证内容**:
- ✅ 环境变量配置
- ✅ 数据库配置
- ✅ 应用构建
- ✅ 代码质量

#### 1.2 查看验证结果

验证结果保存在 `TEST-ENV-VERIFICATION-RESULT-*.md` 文件中。

**检查项目**:
- 所有必需的环境变量已配置
- 数据库迁移状态正常
- TypeScript 编译无阻塞性错误
- 硬编码 Token 已移除
- 权限验证已实现

---

### 阶段 2: 生产环境配置

#### 2.1 创建环境变量文件

```bash
# 复制模板
cp env.production.template .env.production
```

#### 2.2 配置环境变量

编辑 `.env.production` 文件，替换以下占位符:

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | 生产环境 URL（HTTPS） | `https://yesno-app.com` |
| `NEXTAUTH_SECRET` | NextAuth 密钥（32+ 字符） | 使用 `openssl rand -base64 32` 生成 |
| `NODE_ENV` | 运行环境 | `production` |
| `NEXT_PUBLIC_APP_URL` | 应用基础 URL | `https://yesno-app.com` |

#### 2.3 验证环境变量

```bash
# 检查必需变量
grep -E "^DATABASE_URL=|^NEXTAUTH_URL=|^NEXTAUTH_SECRET=" .env.production

# 生成 NEXTAUTH_SECRET（如果未生成）
openssl rand -base64 32
```

---

### 阶段 3: 数据库迁移准备

#### 3.1 在测试环境测试迁移

```bash
# 确保测试环境 DATABASE_URL 已设置
export DATABASE_URL="your-test-database-url"

# 执行测试迁移
bash scripts/test-migration.sh
```

**检查项**:
- ✅ 迁移状态检查通过
- ✅ 迁移执行成功
- ✅ Prisma Client 生成成功
- ✅ 数据库连接正常

#### 3.2 备份生产数据库

```bash
# 设置生产数据库 URL
export DATABASE_URL="your-production-database-url"

# 执行备份
bash scripts/backup-database.sh
```

**备份文件位置**: `backups/yesno_db_backup_YYYYMMDD_HHMMSS.sql.gz`

**重要**: 
- ⚠️ 备份文件存储在安全位置
- ⚠️ 保留至少 30 天
- ⚠️ 定期验证备份完整性

---

### 阶段 4: 生产环境部署

#### 4.1 执行部署脚本

```bash
# 确保 .env.production 已配置
# 执行部署
bash scripts/deploy-production.sh
```

**部署流程**:
1. ✅ 加载环境变量
2. ✅ 备份数据库
3. ✅ 安装生产依赖
4. ✅ 运行数据库迁移
5. ✅ 生成 Prisma Client
6. ✅ 构建应用

#### 4.2 启动应用

```bash
# 启动生产服务器
npm start
```

#### 4.3 健康检查

执行以下检查以确保部署成功:

1. **首页检查**
   ```bash
   curl https://your-domain.com
   ```
   - ✅ 返回 200 OK
   - ✅ 页面正常渲染

2. **API 检查**
   ```bash
   curl https://your-domain.com/api/markets
   ```
   - ✅ 返回 JSON 数据
   - ✅ 无错误响应

3. **日志检查**
   - ✅ 无错误日志
   - ✅ 无警告日志

---

## 📄 创建的文件

### 脚本文件

1. **`scripts/verify-test-env.sh`**
   - 用途: 自动验证测试环境配置
   - 输出: 生成验证结果报告

2. **`scripts/backup-database.sh`**
   - 用途: 备份 PostgreSQL 数据库
   - 输出: 压缩的备份文件

3. **`scripts/test-migration.sh`**
   - 用途: 在测试环境测试数据库迁移
   - 输出: 迁移状态报告

4. **`scripts/deploy-production.sh`**
   - 用途: 执行生产环境部署流程
   - 输出: 部署状态报告

### 配置文件

1. **`env.production.template`**
   - 用途: 生产环境变量配置模板
   - 说明: 包含所有必需的环境变量和注释

### 文档文件

1. **`DEPLOYMENT-EXECUTION-SUMMARY.md`**
   - 用途: 部署执行总结
   - 内容: 详细的执行步骤和说明

2. **`FINAL-DEPLOYMENT-GUIDE.md`**
   - 用途: 本文件（最终部署指南）

---

## ⚠️ 重要注意事项

### 1. 环境变量安全

- ⚠️ **不要**将 `.env.production` 提交到 Git
- ⚠️ **验证** `.env.production` 已在 `.gitignore` 中
- ⚠️ **使用**环境变量管理工具（如 Vercel、Railway）

### 2. 数据库安全

- ⚠️ **使用**强密码
- ⚠️ **启用** SSL 连接（如果支持）
- ⚠️ **限制**数据库访问 IP
- ⚠️ **定期**备份数据库

### 3. 部署安全

- ⚠️ **使用** HTTPS
- ⚠️ **启用**安全头（如 HSTS、CSP）
- ⚠️ **限制**管理后台访问 IP（如果可能）
- ⚠️ **监控**异常访问

### 4. 回滚准备

如果部署出现问题:

1. **停止应用**
   ```bash
   # 停止当前运行的进程
   ```

2. **恢复数据库**（如果需要）
   ```bash
   # 从备份恢复
   gunzip -c backups/yesno_db_backup_*.sql.gz | psql $DATABASE_URL
   ```

3. **切换到上一个版本**
   ```bash
   git checkout <previous-tag>
   npm install --production
   npm run build
   npm start
   ```

---

## ✅ 部署检查清单

在执行生产部署前，请确认:

- [ ] 测试环境验证通过
- [ ] `.env.production` 已创建并配置
- [ ] 所有必需的环境变量已设置
- [ ] 生产数据库已备份
- [ ] 迁移已在测试环境测试
- [ ] 回滚计划已准备
- [ ] 监控和日志已配置
- [ ] HTTPS 已配置
- [ ] 安全头已配置

---

## 📊 部署状态跟踪

| 阶段 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 阶段 1 | 测试环境验证 | ⏳ | 待执行 |
| 阶段 2 | 生产环境配置 | ⏳ | 待执行 |
| 阶段 3 | 数据库迁移准备 | ⏳ | 待执行 |
| 阶段 4 | 生产环境部署 | ⏳ | 待执行 |

---

## 🎯 下一步行动

1. **执行测试环境验证**
   ```bash
   bash scripts/verify-test-env.sh
   ```

2. **配置生产环境变量**
   ```bash
   cp env.production.template .env.production
   # 编辑 .env.production
   ```

3. **测试数据库迁移**
   ```bash
   bash scripts/test-migration.sh
   ```

4. **备份生产数据库**
   ```bash
   bash scripts/backup-database.sh
   ```

5. **执行生产部署**
   ```bash
   bash scripts/deploy-production.sh
   ```

---

**所有脚本和模板已准备就绪，可以开始执行部署流程！**

