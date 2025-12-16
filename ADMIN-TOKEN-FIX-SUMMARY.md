# Admin Token Cookie 修复总结

**执行时间：** 2024-12-16

---

## ✅ 修复完成

### 修复一：Admin Token Cookie 设置

**文件：** `app/api/admin/auth/login/route.ts`

**主要修复：**

1. **✅ Token Key 一致性验证**
   - Cookie Key 严格使用 `adminToken`（与 `middleware.ts` 一致）
   - 添加了注释说明 Key 必须与 Middleware 保持一致

2. **✅ Token 有效期设置**
   - `maxAge: 60 * 60 * 24 * 7` (7 天 = 604800 秒)
   - 确保 Token 不会立即过期

3. **✅ HttpOnly 属性**
   - `httpOnly: true`（安全要求）
   - `secure: process.env.NODE_ENV === 'production'`（生产环境使用 HTTPS）
   - `sameSite: 'lax'`
   - `path: '/'`（确保在所有路径下可用）

4. **✅ 调试日志**
   - 添加了 Cookie 设置成功的日志输出

### 修复二：统一 Admin 权限验证函数

**文件：** `lib/adminAuth.ts` (新创建)

**核心功能：**

1. **✅ `verifyAdminToken()` 函数**
   - 从 Cookie 中读取 `adminToken`
   - 解析 Token 格式：`admin-token-{userId}-{timestamp}-{random}`
   - 从数据库验证用户是否存在
   - **强制 Admin 检查：验证 `isAdmin: true`**
   - 验证账户是否被禁用
   - 返回标准化的验证结果

2. **✅ `createUnauthorizedResponse()` 函数**
   - 统一的未授权响应创建函数
   - 返回标准的 401/403 响应，而不是抛出异常

**验证逻辑：**
```typescript
// 1. 从 Cookie 读取 adminToken
const adminToken = cookieStore.get('adminToken');

// 2. 解析 Token 提取 userId
const userId = tokenParts[2];

// 3. 从数据库验证用户
const user = await DBService.findUserById(userId);

// 4. 强制验证 isAdmin
if (!user.isAdmin) {
  return { success: false, error: '...', statusCode: 403 };
}
```

### 修复三：修复所有 Admin API 路由

**已修复的文件：**
- ✅ `app/api/admin/withdrawals/route.ts` (GET & POST)
- ✅ `app/api/admin/markets/route.ts` (GET & POST)
- ✅ `app/api/admin/markets/[market_id]/route.ts` (PUT)
- ✅ `app/api/admin/markets/[market_id]/settle/route.ts` (POST)
- ✅ `app/api/admin/resolve/[market_id]/route.ts` (POST)
- ✅ `app/api/admin/users/route.ts` (GET)
- ✅ `app/api/admin/users/[user_id]/ban/route.ts` (POST)
- ✅ `app/api/admin/deposits/route.ts` (GET)
- ✅ `app/api/admin/finance/summary/route.ts` (GET)
- ✅ `app/api/admin/logs/route.ts` (GET)
- ✅ `app/api/admin/withdrawals/[order_id]/route.ts` (POST)

**统一修改：**
- 移除硬编码的 `ADMIN_SECRET_TOKEN` 和 Authorization header 验证
- 改为使用 `verifyAdminToken(request)` 从 Cookie 读取
- 使用 `createUnauthorizedResponse()` 返回标准错误响应

**修改前：**
```typescript
const authHeader = request.headers.get('authorization');
const expectedAuthHeader = `Bearer ${ADMIN_SECRET_TOKEN}`;
if (!authHeader || authHeader !== expectedAuthHeader) {
  return NextResponse.json({ error: '...' }, { status: 401 });
}
```

**修改后：**
```typescript
const authResult = await verifyAdminToken(request);
if (!authResult.success) {
  return createUnauthorizedResponse(
    authResult.error || 'Unauthorized. Admin access required.',
    authResult.statusCode || 401
  );
}
```

---

## 🔍 关键验证点

### Cookie 设置验证

**登录 API (`app/api/admin/auth/login/route.ts`):**
- ✅ Cookie Key: `adminToken`（与 middleware.ts 一致）
- ✅ maxAge: `60 * 60 * 24 * 7` (7 天)
- ✅ httpOnly: `true`
- ✅ path: `'/'`
- ✅ secure: 仅在生产环境启用

### Middleware 验证

**Middleware (`middleware.ts`):**
- ✅ 检查 Cookie Key: `adminToken`
- ✅ 排除 `/admin/login` 路径
- ✅ 排除 `/api` 路径（API 路由有自己的验证）

### API 路由验证

**所有 Admin API 路由:**
- ✅ 使用统一的 `verifyAdminToken()` 函数
- ✅ 从 Cookie 读取 `adminToken`
- ✅ 验证用户 `isAdmin: true`
- ✅ 返回标准 401/403 响应

---

## 📋 验证步骤

### 1. 测试 Admin 登录

1. 访问: http://localhost:3000/admin/login
2. 使用凭证: `yesno@yesno.com` / `yesno2025`
3. 登录成功

**验证 Cookie:**
- 打开浏览器开发者工具
- Application → Cookies → http://localhost:3000
- 应该看到 `adminToken` Cookie
- 验证 Cookie 属性：HttpOnly, Path=/, Max-Age=604800

### 2. 测试 Admin API 调用

登录后，访问任意 Admin API：
- `GET /api/admin/users`
- `GET /api/admin/withdrawals`

**预期结果：**
- ✅ API 返回数据（不是 401 错误）
- ✅ 服务器日志显示验证成功

### 3. 测试权限验证失败

清除 Cookie 或使用无效 Token：
- 删除 `adminToken` Cookie
- 访问 Admin API

**预期结果：**
- ✅ 返回 401 Unauthorized
- ✅ 错误消息: "Unauthorized. Admin access required."

---

## 🔧 技术细节

### Token 格式

```
admin-token-{userId}-{timestamp}-{random}
```

示例：
```
admin-token-16737f1c-4bf9-4b33-895c-841274bf8051-1734297600000-abc123
```

### 验证流程

1. **从 Cookie 读取** → `adminToken` 值
2. **解析 Token** → 提取 `userId`
3. **数据库查询** → `DBService.findUserById(userId)`
4. **权限验证** → 检查 `user.isAdmin === true`
5. **账户状态** → 检查 `user.isBanned === false`
6. **返回结果** → `{ success: true, userId }`

---

## ✅ 修复状态

- [x] Cookie Key 一致性（adminToken）
- [x] Token 有效期设置（7 天）
- [x] HttpOnly 属性设置
- [x] 统一权限验证函数创建
- [x] 所有 Admin API 路由已更新
- [x] 强制 Admin 检查（isAdmin: true）
- [x] 标准错误响应（401/403）

---

**所有修复已完成！** 🎉

现在 Admin Token 验证系统：
1. 统一从 Cookie 读取 `adminToken`
2. 统一验证用户 `isAdmin` 标志
3. 统一错误处理和响应格式
4. 与 Middleware 完全一致

