# 用户系统和资产系统 ID 匹配审计报告

## 🔴 发现的严重问题

### 1. **多重认证系统混用**

系统中同时存在 **3 种不同的认证方式**，导致用户 ID 获取不一致：

#### 认证方式 A：NextAuth (推荐)
- **API**: `/api/user/assets`
- **获取方式**: `const session = await auth(); const userId = session.user.id;`
- **Cookie**: `next-auth.session-token` 或 `__Secure-next-auth.session-token`
- **状态**: ✅ 正确使用

#### 认证方式 B：auth_core_session (旧系统)
- **API**: `/api/positions`
- **获取方式**: `const sessionId = cookieStore.get('auth_core_session')?.value; const userId = await getSession(sessionId);`
- **Cookie**: `auth_core_session`
- **状态**: ⚠️ 与 NextAuth 不同步

#### 认证方式 C：authToken (已废弃)
- **工具函数**: `extractUserIdFromToken()` (lib/authUtils.ts)
- **获取方式**: 从 `authToken` cookie 解析 UUID
- **Cookie**: `authToken`
- **状态**: ❌ 已废弃，但仍有部分代码在使用

### 2. **ID 获取不一致的具体问题**

#### 问题 1: `/api/positions` 使用旧的认证系统
```typescript
// app/api/positions/route.ts
const sessionId = cookieStore.get('auth_core_session')?.value;
const userId = await getSession(sessionId);
```

**问题**：
- NextAuth 登录时不会设置 `auth_core_session` cookie
- 导致用户登录后无法获取持仓数据
- 与 `/api/user/assets` 的认证方式不一致

#### 问题 2: `/api/auth/me` 和 `/api/user/assets` 的 ID 来源不同
```typescript
// /api/auth/me: 使用 email 查找
const user = await prisma.user.findUnique({
  where: { email: session.user.email }
});

// /api/user/assets: 直接使用 session.user.id
const userId = session.user.id;
```

**问题**：
- `/api/auth/me` 需要通过 email 查询数据库才能获取 ID
- `/api/user/assets` 直接从 session 获取 ID
- 虽然结果应该一致，但查询路径不同，增加不一致风险

### 3. **潜在的 ID 不匹配场景**

1. **用户登录后**：
   - NextAuth 设置 `next-auth.session-token`
   - 但不设置 `auth_core_session`
   - `/api/positions` 无法获取用户 ID

2. **用户切换**：
   - StoreContext 使用 `currentUser.id`（来自 AuthProvider）
   - AuthProvider 从 `/api/auth/me` 获取用户数据
   - 资产 API 使用 `session.user.id`（来自 NextAuth）
   - 如果 NextAuth session 不同步，会导致 ID 不匹配

3. **localStorage 中的用户 ID**：
   - StoreContext 使用 `pm_currentUser` localStorage
   - 与 API 返回的用户 ID 可能不一致

## ✅ 修复建议

### 修复 1: 统一使用 NextAuth 认证

**所有资产相关 API 都应该使用 NextAuth**：

```typescript
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  const userId = session.user.id;
  // 使用 userId 查询数据
}
```

### 修复 2: 废弃旧的认证系统

- 移除 `auth_core_session` cookie 的使用
- 移除 `authToken` cookie 的解析逻辑（extractUserIdFromToken）
- 统一使用 NextAuth

### 修复 3: 确保 session.user.id 正确设置

检查 NextAuth 配置，确保 `session.user.id` 正确映射：

```typescript
// lib/auth.ts - session callback
async session({ session, token }: any) {
  if (session.user) {
    session.user.id = token.sub as string; // ✅ 正确
  }
  return session;
}
```

## 📋 需要修复的文件

1. ✅ `/app/api/user/assets/route.ts` - 已使用 NextAuth ✅
2. ❌ `/app/api/positions/route.ts` - 需要改为 NextAuth
3. ❌ `/app/api/orders/route.ts` - 需要检查是否使用 NextAuth
4. ❌ `/app/api/deposit/route.ts` - 需要检查是否使用 NextAuth
5. ❌ `/app/api/withdraw/route.ts` - 需要检查是否使用 NextAuth
6. ❌ `/app/api/transactions/route.ts` - 需要检查是否使用 NextAuth
7. ❌ `/lib/authUtils.ts` - extractUserIdFromToken 已废弃

## 🔍 检查清单

- [ ] 所有资产相关 API 都使用 NextAuth
- [ ] 移除所有 `auth_core_session` 的使用
- [ ] 移除所有 `authToken` cookie 的使用
- [ ] 确保 session.user.id 在所有 API 中一致
- [ ] 测试用户登录后所有资产数据能正确获取
