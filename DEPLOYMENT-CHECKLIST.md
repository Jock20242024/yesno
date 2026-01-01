# 部署检查清单

**准备日期**: 2025-01-30  
**用途**: 生产环境部署前的最终检查

---

## ✅ 代码质量检查

### 已完成 ✅

- [x] **TypeScript 编译**: 关键错误已修复
- [x] **硬编码 Token**: 已移除
- [x] **权限验证**: 已恢复
- [x] **console.log**: 已清理（710个）
- [x] **alert()**: 已替换为 toast（81个）
- [x] **数据清洗**: 已完成（阶段2）

---

## ⏳ 部署前必须完成

### 1. 环境变量配置

- [ ] **创建 `.env.production` 文件**
  ```env
  DATABASE_URL="postgresql://..."
  NEXTAUTH_URL="https://your-domain.com"
  NEXTAUTH_SECRET="your-secret-key"
  NODE_ENV="production"
  NEXT_PUBLIC_APP_URL="https://your-domain.com"
  ```

- [ ] **验证环境变量**
  - 所有必需的环境变量已设置
  - 环境变量值正确
  - 敏感信息不在代码中

---

### 2. 数据库准备

- [ ] **备份数据库**
  ```bash
  pg_dump -h host -U user database > backup_$(date +%Y%m%d).sql
  ```

- [ ] **运行数据库迁移**
  ```bash
  npx prisma migrate deploy
  ```

- [ ] **生成 Prisma Client**
  ```bash
  npx prisma generate
  ```

- [ ] **验证系统账户**
  - 系统账户（手续费、AMM）已创建
  - 管理员账户存在

---

### 3. 构建验证

- [ ] **生产构建**
  ```bash
  npm run build
  ```
  - 验证: 构建成功，无错误

- [ ] **构建优化**
  - `swcMinify: true` ✅
  - `compress: true` ✅
  - `reactStrictMode: true` ✅

---

### 4. 安全性配置

- [ ] **HTTPS**
  - SSL 证书已配置
  - HTTP 重定向到 HTTPS

- [ ] **Cookie 安全**
  - HttpOnly Cookie ✅
  - Secure Cookie（生产环境）✅
  - SameSite Cookie ✅

- [ ] **CORS 配置**
  - 只允许必要的域名

---

### 5. 监控和日志

- [ ] **日志配置**
  - 生产环境只记录 error 和 warn
  - 日志存储已配置

- [ ] **监控配置**
  - 应用监控（Sentry 等）
  - 数据库监控
  - 服务器监控

---

### 6. 备份策略

- [ ] **数据库备份**
  - 自动备份已配置
  - 备份保留策略已设置

- [ ] **代码备份**
  - 所有代码已提交到 Git
  - 创建部署标签

---

## 🚀 部署步骤

### 步骤 1: 代码准备
```bash
# 确保所有代码已提交
git add .
git commit -m "准备生产部署"
git tag v1.0.0
```

### 步骤 2: 环境配置
```bash
# 在生产服务器上配置环境变量
# 创建 .env.production 文件
```

### 步骤 3: 数据库迁移
```bash
# 备份数据库
pg_dump ... > backup.sql

# 运行迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate
```

### 步骤 4: 构建应用
```bash
# 安装依赖
npm install --production

# 构建
npm run build
```

### 步骤 5: 启动应用
```bash
# 启动生产服务器
npm start
```

### 步骤 6: 健康检查
- [ ] 访问首页，验证正常
- [ ] 访问 API，验证正常
- [ ] 检查日志，无错误

---

## ⚠️ 回滚计划

如果部署出现问题，按以下步骤回滚：

1. **停止当前应用**
2. **恢复数据库备份**（如果需要）
3. **切换到上一个版本**
   ```bash
   git checkout v0.9.0
   ```
4. **重新构建和启动**

---

## 📊 部署状态

### 准备状态

| 项目 | 状态 | 备注 |
|------|------|------|
| 代码质量 | ✅ | 已完成 |
| 环境变量 | ⏳ | 待配置 |
| 数据库 | ⏳ | 待迁移 |
| 构建 | ⏳ | 待验证 |
| 安全 | ⏳ | 待配置 |
| 监控 | ⏳ | 待配置 |
| 备份 | ⏳ | 待配置 |

---

## ✅ 部署就绪标准

所有以下项目必须完成：

1. ✅ 代码质量检查通过
2. ⏳ 环境变量已配置
3. ⏳ 数据库迁移已应用
4. ⏳ 构建成功
5. ⏳ 安全性配置完成
6. ⏳ 监控已配置
7. ⏳ 备份策略已设置
8. ⏳ 回滚计划已准备

---

**完成所有检查项后，可以开始部署到生产环境。**

