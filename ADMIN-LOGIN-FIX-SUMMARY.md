# 后台登录重定向死循环 - 彻底修复总结

## 问题描述
后台登录后出现重定向死循环，无法正常访问管理后台。

## 根本原因
1. **双重认证机制混乱**：同时使用 `adminToken` cookie 和 NextAuth session，导致逻辑冲突
2. **Middleware 检查逻辑复杂**：同时检查 `adminToken` cookie 和 NextAuth session，容易出错
3. **登录流程不一致**：Google 登录使用 NextAuth，邮箱密码登录使用手动设置的 cookie

## 修复方案

### 1. 简化 Middleware（middleware.ts）
**修改前**：
- 同时检查 `adminToken` cookie 和 NextAuth session
- 逻辑复杂，容易出错

**修改后**：
- ✅ **完全信任 NextAuth Session**
- ✅ 只检查 `user.role === 'ADMIN'`
- ✅ 不再检查 `adminToken` cookie（已废弃）

```typescript
// 关键代码
const userRole = (session?.user as any)?.role;
const isAdmin = userRole === 'ADMIN';

if (isAdminRoute && pathname !== '/admin/login') {
  if (!isAuthenticated || !isAdmin) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}
```

### 2. 强制 Session Role 注入（lib/auth.ts）
**已确认**：
- ✅ `jwt` callback 中设置 `token.role = isAdmin ? 'ADMIN' : 'USER'`
- ✅ `session` callback 中设置 `session.user.role = isAdmin ? 'ADMIN' : 'USER'`
- ✅ 每次都会从数据库查询最新的 `isAdmin` 状态

### 3. 修复 Admin 登录 API（app/api/admin/auth/login/route.ts）
**修改前**：
- 手动设置 `adminToken` cookie
- 不创建 NextAuth session

**修改后**：
- ✅ 仅用于验证凭据
- ✅ 实际登录由前端调用 NextAuth `signIn` 完成
- ✅ 返回成功状态，前端再调用 NextAuth

### 4. 修复登录页面（app/admin/login/page.tsx）
**修改前**：
- 调用自定义 API `/api/admin/auth/login`
- 手动设置 cookie，然后跳转

**修改后**：
- ✅ **直接使用 NextAuth 的 `signIn('credentials')`**
- ✅ 自动创建 NextAuth session
- ✅ 登录成功后立即硬跳转：`window.location.href = '/admin/dashboard'`

```typescript
const result = await signIn('credentials', {
  email: email,
  password: password,
  redirect: false, // 不自动跳转，手动控制
});

if (result?.ok) {
  window.location.href = '/admin/dashboard';
}
```

### 5. 数据库用户角色检查
**已确认**：
- ✅ `guanliyuan@yesno.com` 的 `isAdmin` 字段为 `true`
- ✅ 数据库中有 1 个管理员账号

## 验证步骤

1. **清除浏览器数据**（重要！）
   - 清除所有 cookies
   - 清除 localStorage 和 sessionStorage

2. **访问后台登录页**
   - 访问 `http://localhost:3000/admin/login`

3. **使用邮箱密码登录**
   - 输入 `guanliyuan@yesno.com` 和密码
   - 点击登录

4. **检查 Network 标签**
   - 应该看到：
     - ✅ `POST /api/auth/callback/credentials` 返回 200
     - ✅ 设置 `next-auth.session-token` cookie
     - ✅ 302 重定向到 `/admin/dashboard`
     - ❌ **不应该**看到重定向到 `/admin/login` 的循环

5. **检查 Session**
   - 打开浏览器控制台
   - 检查 `session.user.role` 应该为 `'ADMIN'`

## 技术细节

### NextAuth Session 流程
1. 用户输入邮箱密码
2. 前端调用 `signIn('credentials', { email, password })`
3. NextAuth 调用 `authorize` 函数验证凭据
4. 如果验证成功，NextAuth 创建 JWT token
5. `jwt` callback 设置 `token.role = 'ADMIN'`
6. NextAuth 设置 `next-auth.session-token` cookie
7. `session` callback 设置 `session.user.role = 'ADMIN'`
8. Middleware 检查 `session.user.role === 'ADMIN'`
9. 允许访问 `/admin/*` 路由

### 关键修复点
- ✅ **统一认证机制**：所有登录都使用 NextAuth session
- ✅ **简化 Middleware**：只检查 NextAuth session 的 role
- ✅ **硬跳转**：登录成功后使用 `window.location.href` 立即跳转
- ✅ **Role 注入**：确保 jwt 和 session callback 都正确设置 role

## 注意事项

1. **Google 登录**：仍然使用 NextAuth，但会检查 `isAdmin` 并设置 `role`
2. **邮箱密码登录**：现在也使用 NextAuth，与 Google 登录一致
3. **Session 同步**：每次请求都会从数据库查询最新的 `isAdmin` 状态
4. **Cookie 清理**：旧的 `adminToken` cookie 可以忽略，不再使用

## 测试建议

1. ✅ 清除浏览器数据后测试登录
2. ✅ 检查 Network 标签，确认没有重定向循环
3. ✅ 验证 `session.user.role === 'ADMIN'`
4. ✅ 测试 Google 登录（如果配置了）
5. ✅ 测试登出后重新登录

## 相关文件

- `middleware.ts` - 路由保护逻辑
- `lib/auth.ts` - NextAuth 配置
- `app/api/admin/auth/login/route.ts` - Admin 登录 API（已简化）
- `app/admin/login/page.tsx` - Admin 登录页面
- `scripts/check-user-role.ts` - 检查用户角色脚本
