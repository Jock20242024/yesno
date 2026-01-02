# 管理员账户设置指南

## 为什么管理员有独立的登录页面？

管理员使用独立的登录页面 (`/admin/login`) 有以下原因：

1. **安全隔离**：管理员和普通用户的登录流程分离，降低安全风险
2. **权限管理**：管理员登录后需要额外的权限验证（`isAdmin: true`）
3. **用户体验**：管理员界面和普通用户界面完全不同，需要独立的入口
4. **审计追踪**：管理员操作需要单独记录和追踪

## 创建管理员账户的方法

### 方法 1：使用 create-admin 脚本（推荐）

这是最灵活的方法，可以创建任意邮箱和密码的管理员账户。

```bash
npx tsx scripts/create-admin.ts <邮箱> <密码>
```

**示例：**
```bash
npx tsx scripts/create-admin.ts admin@example.com mypassword123
```

**功能：**
- 如果邮箱已存在，会将现有账户升级为管理员并更新密码
- 如果邮箱不存在，会创建新的管理员账户
- 自动对密码进行安全哈希处理

### 方法 2：使用 Prisma Seed（默认管理员）

这会创建一个默认的管理员账户。

```bash
npx prisma db seed
```

**默认账户信息：**
- **邮箱**: `yesno@yesno.com`
- **密码**: `yesno2025`
- **权限**: 管理员 (`isAdmin: true`)

**注意：** 如果该邮箱已存在，seed 会更新密码和管理员状态。

## 管理员登录方式

管理员可以通过以下方式登录：

1. **邮箱密码登录**（`/admin/login`）
   - 使用管理员邮箱和密码
   - 通过 `/api/admin/auth/login` API 验证

2. **Google OAuth 登录**（`/admin/login`）
   - 使用 Google 账号登录
   - 前提：该 Google 账号在数据库中的 `isAdmin` 字段为 `true`

## 验证管理员账户

创建管理员账户后，可以通过以下方式验证：

```bash
# 使用 Prisma Studio 查看数据库
npx prisma studio

# 或使用 SQL 查询
npx prisma db execute --stdin <<< "SELECT email, \"isAdmin\", \"isBanned\" FROM users WHERE \"isAdmin\" = true;"
```

## 常见问题

### Q: 如何将现有普通用户升级为管理员？

**A:** 使用 `create-admin` 脚本，传入该用户的邮箱和新密码（或保持原密码）：

```bash
npx tsx scripts/create-admin.ts existing-user@example.com newpassword
```

脚本会自动检测用户是否存在，如果存在则更新为管理员。

### Q: 如何撤销管理员权限？

**A:** 需要直接修改数据库：

```sql
UPDATE users SET "isAdmin" = false WHERE email = 'admin@example.com';
```

或使用 Prisma Studio 手动修改。

### Q: 管理员登录后跳转到哪里？

**A:** 
- 邮箱密码登录：跳转到 `/admin/dashboard`
- Google OAuth 登录：如果 `isAdmin: true`，也会跳转到 `/admin/dashboard`

### Q: 可以创建多个管理员吗？

**A:** 可以！只需多次运行 `create-admin` 脚本，为不同的邮箱创建管理员账户。

## 安全建议

1. **使用强密码**：管理员密码应该足够复杂
2. **定期更换密码**：建议定期更新管理员密码
3. **限制管理员数量**：只创建必要数量的管理员账户
4. **监控管理员操作**：所有管理员操作都会记录在 `admin_logs` 表中

