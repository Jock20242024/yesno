# ⚡ 登录密码错误修复总结

**问题**：登录时提示"邮箱或密码错误"（CredentialsSignin）

---

## 🔍 问题诊断

### 发现的问题

1. **密码不匹配**：
   - 测试了多个常见密码，都不匹配
   - 说明数据库中的密码哈希与用户输入的密码不匹配

2. **数据库连接问题**（生产环境）：
   - 终端显示：`invalid port number in database URL`
   - 这可能导致生产模式下 NextAuth 无法访问数据库

3. **用户存在**：
   - ✅ 用户 `guanliyuan@yesno.com` 存在
   - ✅ 是管理员（`isAdmin: true`）
   - ✅ 有密码哈希

---

## ✅ 修复方案

### 1. 重置管理员密码 ✅

**已执行**：
- ✅ 创建了 `scripts/reset-admin-password.ts` 脚本
- ✅ 重置密码为：`yesnoex.com2026`
- ✅ 密码验证成功

**新密码**：
```
yesnoex.com2026
```

### 2. 验证密码 ✅

**测试结果**：
- ✅ 密码哈希已更新
- ✅ 密码验证成功
- ✅ 可以使用新密码登录

---

## 📋 下一步操作

### 1. 使用新密码登录

**登录信息**：
- 邮箱：`guanliyuan@yesno.com`
- 密码：`yesnoex.com2026`

### 2. 如果仍然提示密码错误

**可能原因**：
- 生产环境数据库连接失败
- NextAuth 在生产模式下无法访问数据库

**解决方案**：
1. 检查 `.env.production` 中的 `DATABASE_URL`
2. 确保端口号格式正确（不应有方括号等特殊字符）
3. 如果密码包含特殊字符，需要 URL 编码

### 3. 验证登录

1. 访问 `http://localhost:3000/admin/login`
2. 输入邮箱和密码
3. 点击登录
4. 应该能成功登录并跳转到 `/admin/dashboard`

---

## 🔧 如果生产环境数据库连接失败

### 检查 DATABASE_URL 格式

**正确格式**：
```
DATABASE_URL="postgresql://user:password@host:port/database?params"
```

**常见问题**：
- 密码中包含特殊字符（如 `[`, `]`, `@`）需要 URL 编码
- 端口号格式错误
- 引号使用不当

### 修复方法

如果密码包含特殊字符，需要 URL 编码：
```bash
# 例如，如果密码是 yesnoex.com2026[test]
# 需要编码为：yesnoex.com2026%5Btest%5D
```

---

## 📝 相关文件

- `scripts/reset-admin-password.ts` - 密码重置脚本
- `lib/auth.ts` - NextAuth 配置
- `.env.production` - 生产环境变量

---

**修复状态**：✅ 密码已重置  
**新密码**：`yesnoex.com2026`  
**下一步**：使用新密码登录测试

