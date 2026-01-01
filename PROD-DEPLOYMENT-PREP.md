# 生产环境部署准备清单

**准备日期**: 2025-01-30  
**目标环境**: 生产环境

---

## 📋 部署前检查清单

### 1. 代码质量 ✅

- [x] **TypeScript 编译**: 无阻塞性错误
- [x] **ESLint 检查**: 无严重错误
- [x] **硬编码 Token**: 已移除
- [x] **权限验证**: 已恢复
- [x] **console.log**: 已清理（710个）
- [x] **alert()**: 已替换为 toast（81个）

---

### 2. 环境变量配置 ⏳

#### 必需的环境变量

创建 `.env.production` 文件（**不要提交到 Git**）：

```env
# 数据库配置
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# NextAuth.js 配置
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-production-secret-key-32-chars-minimum"

# 应用配置
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Google OAuth（如果使用）
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# 翻译 API（如果使用）
TRANSLATE_API_KEY="your-translate-api-key"
```

#### 环境变量验证

- [ ] **DATABASE_URL**: 生产数据库连接字符串
  - **格式**: `postgresql://user:password@host:port/database?schema=public`
  - **安全**: 使用强密码，启用 SSL（如果支持）

- [ ] **NEXTAUTH_URL**: 生产环境 URL
  - **格式**: `https://your-domain.com`
  - **注意**: 必须是 HTTPS

- [ ] **NEXTAUTH_SECRET**: 强密钥
  - **长度**: 至少 32 字符
  - **生成**: 可以使用 `openssl rand -base64 32`

- [ ] **NODE_ENV**: 设置为 `production`
  - **验证**: `process.env.NODE_ENV === 'production'`

---

### 3. 数据库准备 ⏳

#### 数据库迁移

- [ ] **备份生产数据库**
  - **命令**: 
    ```bash
    pg_dump -h host -U user database > backup_$(date +%Y%m%d_%H%M%S).sql
    ```
  - **存储**: 安全位置，保留至少 30 天

- [ ] **运行数据库迁移**
  - **命令**: `npx prisma migrate deploy`
  - **注意**: 使用 `migrate deploy` 而不是 `migrate dev`（生产环境）
  - **验证**: 所有迁移成功应用

- [ ] **生成 Prisma Client**
  - **命令**: `npx prisma generate`
  - **验证**: 无错误

#### 数据库数据

- [ ] **系统账户**
  - **验证**: 系统账户（手续费账户、AMM 账户等）已创建
  - **查询**: 
    ```sql
    SELECT email FROM users WHERE email LIKE 'system.%';
    ```

- [ ] **管理员账户**
  - **验证**: 至少有一个管理员账户
  - **查询**: 
    ```sql
    SELECT email, "isAdmin" FROM users WHERE "isAdmin" = true;
    ```

- [ ] **数据清洗**
  - **状态**: ✅ 已完成（阶段2）
  - **验证**: 测试数据已清理

---

### 4. 构建优化 ⏳

#### Next.js 构建配置

- [ ] **生产构建**
  - **命令**: `npm run build`
  - **验证**: 构建成功，无错误
  - **检查**: `.next` 目录已生成

- [ ] **构建优化**
  - **验证**: `next.config.mjs` 中已启用：
    - `swcMinify: true` ✅
    - `compress: true` ✅
    - `reactStrictMode: true` ✅

- [ ] **静态资源**
  - **验证**: 静态资源（图片、字体等）已优化
  - **检查**: 图片使用 Next.js Image 组件

---

### 5. 安全性配置 ⏳

#### HTTPS 配置

- [ ] **SSL 证书**
  - **验证**: SSL 证书已配置
  - **工具**: Let's Encrypt、Cloudflare 等

- [ ] **HTTPS 重定向**
  - **验证**: HTTP 请求自动重定向到 HTTPS
  - **配置**: 在反向代理（Nginx、Cloudflare）中配置

#### Cookie 安全

- [ ] **HttpOnly Cookie**
  - **验证**: 认证 Token 使用 HttpOnly Cookie
  - **状态**: ✅ 已实现

- [ ] **Secure Cookie**
  - **验证**: 生产环境 Cookie 使用 `secure: true`
  - **检查**: `app/api/auth/login/route.ts` 中 `secure: process.env.NODE_ENV === 'production'`

- [ ] **SameSite Cookie**
  - **验证**: Cookie 使用 `sameSite: 'lax'` 或 `'strict'`
  - **状态**: ✅ 已配置

#### CORS 配置

- [ ] **CORS 策略**
  - **验证**: CORS 已正确配置
  - **检查**: 只允许必要的域名访问

---

### 6. 监控和日志 ⏳

#### 日志配置

- [ ] **日志级别**
  - **生产环境**: 只记录 `error` 和 `warn`
  - **开发环境**: 可以记录 `log`、`info`、`debug`

- [ ] **日志存储**
  - **选择**: 文件、数据库、日志服务（如 Logtail、Datadog）
  - **配置**: 日志轮转和保留策略

#### 监控配置

- [ ] **应用监控**
  - **工具**: Sentry、New Relic、Datadog 等
  - **配置**: 错误追踪、性能监控

- [ ] **数据库监控**
  - **工具**: PostgreSQL 监控工具
  - **指标**: 连接数、查询性能、磁盘使用

- [ ] **服务器监控**
  - **工具**: 服务器监控工具（如 Uptime Robot）
  - **指标**: CPU、内存、磁盘、网络

---

### 7. 备份策略 ⏳

#### 数据库备份

- [ ] **自动备份**
  - **频率**: 每天至少一次
  - **保留**: 至少 30 天
  - **工具**: `pg_dump`、数据库托管服务备份

- [ ] **备份验证**
  - **测试**: 定期测试备份恢复
  - **验证**: 备份文件完整性

#### 代码备份

- [ ] **版本控制**
  - **验证**: 所有代码已提交到 Git
  - **分支**: 生产代码在 `main` 或 `production` 分支

- [ ] **部署标签**
  - **创建**: 为每个生产部署创建 Git 标签
  - **格式**: `v1.0.0`、`v1.0.1` 等

---

### 8. 部署流程 ⏳

#### 部署步骤

1. [ ] **代码准备**
   - 确保所有代码已提交
   - 创建部署标签

2. [ ] **环境变量配置**
   - 在生产服务器上配置环境变量
   - 验证环境变量正确

3. [ ] **数据库迁移**
   - 备份数据库
   - 运行迁移：`npx prisma migrate deploy`

4. [ ] **构建应用**
   - 安装依赖：`npm install --production`
   - 构建应用：`npm run build`

5. [ ] **启动应用**
   - 启动生产服务器：`npm start`
   - 验证应用正常运行

6. [ ] **健康检查**
   - 访问首页，验证正常
   - 访问 API，验证正常
   - 检查日志，无错误

#### 回滚计划

- [ ] **回滚步骤**
  1. 停止当前应用
  2. 恢复数据库备份（如果需要）
  3. 切换到上一个版本标签
  4. 重新构建和启动

- [ ] **回滚测试**
  - 在测试环境测试回滚流程
  - 验证回滚后应用正常

---

### 9. 性能优化 ⏳

#### 构建优化

- [ ] **代码分割**
  - **验证**: Next.js 自动代码分割
  - **检查**: 使用动态导入（`dynamic import`）优化大组件

- [ ] **图片优化**
  - **验证**: 使用 Next.js Image 组件
  - **配置**: 图片 CDN（如 Cloudinary、Imgix）

#### 缓存策略

- [ ] **静态资源缓存**
  - **配置**: 浏览器缓存静态资源
  - **工具**: CDN、反向代理

- [ ] **API 缓存**
  - **配置**: 适当的 API 缓存策略
  - **注意**: 用户数据不应缓存

---

### 10. 文档准备 ⏳

- [ ] **部署文档**
  - 创建部署步骤文档
  - 记录环境变量配置
  - 记录数据库迁移步骤

- [ ] **运维文档**
  - 创建运维手册
  - 记录常见问题解决方案
  - 记录监控和日志查看方法

---

## 📊 部署准备状态

### 已完成 ✅

- ✅ 代码质量检查
- ✅ 硬编码 Token 移除
- ✅ 权限验证恢复
- ✅ console.log 清理
- ✅ alert() 替换为 toast
- ✅ TypeScript 关键错误修复
- ✅ 数据清洗完成

### 待完成 ⏳

- ⏳ 环境变量配置
- ⏳ 数据库迁移
- ⏳ 构建优化验证
- ⏳ 安全性配置
- ⏳ 监控和日志配置
- ⏳ 备份策略
- ⏳ 部署流程测试

---

## 🚀 部署命令参考

### 开发环境

```bash
# 安装依赖
npm install

# 运行数据库迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate

# 启动开发服务器
npm run dev
```

### 生产环境

```bash
# 安装生产依赖
npm install --production

# 运行数据库迁移（生产环境）
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

---

## ⚠️ 重要注意事项

### 1. 环境变量安全

- ⚠️ **不要**将 `.env.production` 提交到 Git
- ⚠️ **不要**在代码中硬编码敏感信息
- ⚠️ **使用**环境变量管理工具（如 Vercel、Railway 的环境变量配置）

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

---

## ✅ 部署前最终检查

在部署到生产环境之前，请确认：

1. ✅ 所有代码已提交到 Git
2. ✅ 所有测试已通过
3. ✅ 环境变量已配置
4. ✅ 数据库已备份
5. ✅ 数据库迁移已测试
6. ✅ 构建成功
7. ✅ 回滚计划已准备
8. ✅ 监控已配置

---

**准备完成后，可以开始部署到生产环境。**

