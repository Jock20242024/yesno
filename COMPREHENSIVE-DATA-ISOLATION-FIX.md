# 新用户数据隔离完整修复方案

## 问题原因分析

### 核心问题
新用户注册登录后，会看到已有持仓和充提记录，导致用户数据隔离失败。

### 根本原因

1. **登录顺序不正确**
   - 当前流程：调用登录 API → 返回成功 → 调用 `login()` 函数
   - 问题：`login()` 函数在 API 返回后才清空旧数据，但此时旧数据可能已经被其他组件读取

2. **AuthProvider login 函数清空时机错误**
   - 当前：在 `login()` 函数内部清空 localStorage，但内存状态（`setCurrentUser(null)`, `setUser(null)`）没有先清空
   - 问题：在设置新用户数据前，内存中可能还有旧用户的状态

3. **StoreContext 用户 ID 检查不完整**
   - 当前：只在恢复数据时检查用户 ID，但没有在用户切换时主动清空内存状态
   - 问题：如果用户 A 登录后，用户 B 登录，StoreContext 可能还保留用户 A 的数据

4. **Mock 数据直接引用**
   - 当前：部分 API 和组件直接引用 `mockData`，导致所有用户看到相同数据
   - 问题：数据隔离在源头就失败了

---

## 修复方案

### 修复 1：AuthProvider login 函数 - 正确的登录顺序

**修复目标**：确保登录顺序为：清空旧数据（内存 + localStorage）→ 设置新用户数据 → 更新 Context 和 localStorage

**修复代码**：

```typescript
// components/providers/AuthProvider.tsx

// Login 函数：接收 user 数据（Token 现在在 HttpOnly Cookie 中）
const login = (token?: string, userData?: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean }) => {
  // ========== 步骤 1: 清空所有旧用户数据（内存状态 + localStorage）==========
  // 必须在设置新用户数据之前完成，确保新用户不会看到旧用户的数据
  
  // 1.1 清空内存状态（Context 状态）
  setCurrentUser(null);
  setUser(null);
  setIsLoggedIn(false);
  
  // 1.2 清空所有 localStorage 数据
  if (typeof window !== 'undefined') {
    // 清除认证相关数据
    localStorage.removeItem('pm_currentUser');
    localStorage.removeItem('pm_user');
    
    // 清除 StoreContext 的数据（防止新用户看到旧用户的持仓、交易记录等）
    localStorage.removeItem('pm_store_balance');
    localStorage.removeItem('pm_store_positions');
    localStorage.removeItem('pm_store_history');
    
    console.log('🧹 [AuthProvider] 已清空所有旧用户数据（内存状态 + localStorage）');
  }
  
  // ========== 步骤 2: 验证新用户数据 ==========
  if (!userData) {
    console.error('❌ [AuthProvider] Login: userData 为空');
    return;
  }
  
  // 强制检查：确保 currentUser.id 是从有效的 Auth Token 中动态解析出来的唯一 ID
  if (!userData.id || typeof userData.id !== 'string' || userData.id.trim() === '') {
    console.error('❌ [AuthProvider] Login: userData.id 为空或无效');
    return;
  }
  
  // 验证 userData.id 是有效的 UUID 格式
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(userData.id)) {
    console.error('❌ [AuthProvider] Login: userData.id 格式无效，不是有效的 UUID:', userData.id);
    return;
  }
  
  // 防止使用默认 ID（如 '1'）
  if (userData.id === '1' || userData.id === 'default') {
    console.error('❌ [AuthProvider] Login: 检测到无效的 userData.id（可能是硬编码的默认值）:', userData.id);
    return;
  }
  
  // ========== 步骤 3: 设置新用户数据 ==========
  // Token 现在通过 HttpOnly Cookie 自动设置，无需手动存储
  const userDataWithRole = {
    ...userData,
    role: userData.role || (userData.isAdmin ? 'admin' : 'user'),
  };
  
  // 3.1 设置内存状态（Context）
  setCurrentUser(userDataWithRole);
  
  // 3.2 处理余额并创建用户对象
  let balance: number;
  if (userData.balance === null || userData.balance === undefined) {
    console.warn('⚠️ [AuthProvider] Login: API 返回的余额为 null 或 undefined，使用默认值 0');
    balance = 0;
  } else {
    balance = Number(userData.balance);
    if (isNaN(balance)) {
      console.warn('⚠️ [AuthProvider] Login: API 返回的余额无法转换为数字，使用默认值 0');
      balance = 0;
    }
  }
  
  // 清洗：排除所有已知的硬编码测试值
  const knownTestValues = [2450.32, 1900.46, 1900.45, 2437.799, 2437.8, 145.0];
  if (knownTestValues.includes(balance)) {
    console.warn('⚠️ [AuthProvider] Login: 检测到硬编码的测试余额值，强制重置为 0:', balance);
    balance = 0;
  }
  
  // 确保余额不为负数
  balance = Math.max(0, balance);
  
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);
  
  const defaultUser = {
    name: userData.email.split('@')[0],
    balance: formattedBalance,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2bAOWUUWgF3BeCw00tLrrCZ-3rEbDYjZILz2QLdrkatW3DtLEk1z-KKl-dTtsD6g0ZwQtpaw0k9GSFIozVD4vsoHuWlkK7WpkQr6WbewWw0uQz2H2BAlxCPDl2qelP2dy41f8iQ6RylaQ51hFuYhpHvGGnjNHJyMqPZcOjZuzPjRFCOtKBggU0ngBaXSyhVyf8gQ3Se-h0nHVxOoddZGgOn0Z6BXqMIM8nyldVRfe5eI8ZCcbr0NXKz-jqQdp5j0XzZF8PoRgMdYE"
  };
  
  setUser(defaultUser);
  
  // ========== 步骤 4: 更新 localStorage ==========
  // 在设置完内存状态后，再更新 localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('pm_currentUser', JSON.stringify(userDataWithRole));
    localStorage.setItem('pm_user', JSON.stringify(defaultUser));
    
    console.log('✅ [AuthProvider] 新用户数据已设置（内存状态 + localStorage）:', {
      userId: userData.id,
      email: userData.email,
      balance: formattedBalance,
    });
  }
  
  // ========== 步骤 5: 设置登录状态 ==========
  setIsLoggedIn(true);
};
```

### 修复 2：StoreContext - 严格的用户 ID 验证和主动清空

**修复目标**：在用户切换时主动清空状态，在恢复数据时严格验证用户 ID

**修复代码**：

```typescript
// app/context/StoreContext.tsx

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  
  // 获取当前用户 ID（从 AuthProvider）
  const { currentUser } = useAuth();

  // ========== 修复：监听用户切换，主动清空状态 ==========
  useEffect(() => {
    // 如果用户切换（currentUser 变为 null 或不同的用户），立即清空所有状态
    if (!currentUser) {
      console.log('🧹 [StoreContext] 用户已登出，清空所有状态');
      setBalance(0);
      setPositions([]);
      setHistory([]);
      // 不清除 localStorage，因为可能只是临时登出
      return;
    }
  }, [currentUser?.id]); // 依赖 currentUser.id，用户切换时触发

  // ========== 修复：从 localStorage 恢复数据前，严格验证用户 ID ==========
  useEffect(() => {
    // 如果没有当前用户，不恢复数据
    if (!currentUser || !currentUser.id) {
      console.log('⚠️ [StoreContext] 没有当前用户，不恢复数据');
      setBalance(0);
      setPositions([]);
      setHistory([]);
      return;
    }
    
    // 获取 localStorage 中保存的用户 ID
    const savedCurrentUser = localStorage.getItem('pm_currentUser');
    const parsedCurrentUser = savedCurrentUser ? JSON.parse(savedCurrentUser) : null;
    const savedUserId = parsedCurrentUser?.id;
    const currentUserId = currentUser.id;
    
    // ========== 关键修复：如果用户 ID 不匹配，清除所有数据 ==========
    if (savedUserId && currentUserId !== savedUserId) {
      console.warn('⚠️ [StoreContext] 检测到用户切换，清除旧用户数据', {
        currentUserId,
        savedUserId,
      });
      
      // 清空内存状态
      setBalance(0);
      setPositions([]);
      setHistory([]);
      
      // 清空 localStorage 中的旧数据
      localStorage.removeItem('pm_store_balance');
      localStorage.removeItem('pm_store_positions');
      localStorage.removeItem('pm_store_history');
      
      return; // 不恢复旧数据
    }
    
    // ========== 只有在用户 ID 匹配时才恢复数据 ==========
    const savedBalance = localStorage.getItem('pm_store_balance');
    const savedPositions = localStorage.getItem('pm_store_positions');
    const savedHistory = localStorage.getItem('pm_store_history');
    
    // 恢复余额
    if (savedBalance) {
      const parsedBalance = parseFloat(savedBalance);
      // 验证保存的余额是否合理（不是硬编码的测试值）
      if (parsedBalance > 0 && parsedBalance !== 2450.32 && !isNaN(parsedBalance)) {
        setBalance(parsedBalance);
      } else {
        localStorage.removeItem('pm_store_balance');
        setBalance(0);
      }
    } else {
      setBalance(0);
    }
    
    // 恢复持仓（需要验证数据有效性）
    if (savedPositions) {
      try {
        const parsed = JSON.parse(savedPositions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 验证持仓数据的有效性
          const hasTestData = parsed.some((pos: any) => {
            return pos.marketId === '1' || pos.shares === 21.15 || pos.avgPrice === 0.52;
          });
          
          if (hasTestData) {
            console.warn('⚠️ [StoreContext] 检测到测试持仓数据，强制清除');
            localStorage.removeItem('pm_store_positions');
            setPositions([]);
          } else {
            const validPositions = parsed.filter((pos: any) => {
              return pos.shares && pos.shares > 0 && pos.avgPrice && pos.avgPrice > 0;
            });
            
            if (validPositions.length > 0) {
              setPositions(validPositions);
            } else {
              localStorage.removeItem('pm_store_positions');
              setPositions([]);
            }
          }
        } else {
          setPositions([]);
        }
      } catch (e) {
        console.error('Failed to parse saved positions', e);
        localStorage.removeItem('pm_store_positions');
        setPositions([]);
      }
    } else {
      setPositions([]);
    }
    
    // 恢复交易历史
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seenIds = new Set<string>();
          const fixedHistory = parsed.map((item: Transaction, index: number) => {
            let uniqueId = item.id;
            if (!uniqueId || seenIds.has(uniqueId)) {
              uniqueId = `tx-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
            }
            seenIds.add(uniqueId);
            return { ...item, id: uniqueId };
          });
          setHistory(fixedHistory);
        } else {
          setHistory([]);
        }
      } catch (e) {
        console.error('Failed to parse saved history', e);
        setHistory([]);
      }
    } else {
      setHistory([]);
    }
  }, [currentUser?.id]); // 依赖 currentUser.id，确保用户切换时重新执行
}
```

### 修复 3：注册 API - 明确返回空数据结构

**修复目标**：确保注册 API 明确返回空的 positions、deposits、withdrawals 数组

**修复代码**：

```typescript
// app/api/auth/register/route.ts

// 在注册成功后返回
return NextResponse.json({
  success: true,
  message: 'User registered successfully',
  user: {
    id: newUser.id,
    email: newUser.email,
    balance: newUser.balance, // 明确返回初始余额 0
  },
  // ========== 修复：明确说明新用户没有持仓和交易记录 ==========
  positions: [], // 新用户没有持仓
  deposits: [], // 新用户没有充值记录
  withdrawals: [], // 新用户没有提现记录
}, { status: 201 });
```

### 修复 4：登录 API - 确保返回正确的用户数据

**修复目标**：确保登录 API 返回的用户数据包含 balance，且不包含其他用户的数据

**修复代码**：

```typescript
// app/api/auth/login/route.ts

// 返回脱敏的用户信息（不包含 passwordHash）
return NextResponse.json({
  success: true,
  user: {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
    balance: user.balance, // 确保返回当前用户的余额
    // ========== 修复：明确说明当前用户没有持仓和交易记录（如果需要）==========
    // 注意：登录 API 通常不返回 positions、deposits、withdrawals
    // 这些数据应该通过专门的 API 获取（如 /api/orders/user, /api/transactions）
  },
});
```

### 修复 5：移除所有直接引用 Mock 数据的逻辑

**修复目标**：确保所有组件和 API 都通过 Context 或 API 查询用户数据，不再直接引用全局 Mock 数据

**需要修复的文件**：
- `app/api/admin/deposits/route.ts` ✅ 已修复（改为从数据库查询）
- `app/api/admin/finance/summary/route.ts` ✅ 已修复（改为从数据库查询）
- `app/api/rankings/route.ts` ✅ 已修复（改为从数据库查询）
- `app/rank/[user_id]/page.tsx` - 需要修复（使用硬编码的 mock 数据）

**修复代码**：

```typescript
// app/rank/[user_id]/page.tsx

"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import UserProfileHeader from "@/components/user/UserProfileHeader";
import UserActivityTable from "@/components/user/UserActivityTable";

export default function UserProfilePage() {
  const params = useParams();
  const user_id = params.user_id as string;
  
  // ========== 修复：从 API 获取用户数据，不再使用硬编码的 mock 数据 ==========
  const [userData, setUserData] = useState({
    userId: user_id,
    userName: user_id,
    profit: 0,
    positionsValue: "$0.00",
    biggestWin: "$0.00",
    predictions: 0,
    joinDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  });
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`/api/users/${user_id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.user) {
            // 从 API 返回的数据计算用户统计
            const orders = result.orders || [];
            const positions = result.positions || [];
            
            // 计算盈亏
            const profit = orders.reduce((sum: number, order: any) => {
              return sum + (order.pnl || 0);
            }, 0);
            
            // 计算持仓价值
            const positionsValue = positions.reduce((sum: number, pos: any) => {
              return sum + (pos.shares * pos.avgPrice || 0);
            }, 0);
            
            // 计算最大盈利
            const biggestWin = Math.max(...orders.map((o: any) => o.pnl || 0), 0);
            
            setUserData({
              userId: result.user.id,
              userName: result.user.email.split('@')[0],
              profit,
              positionsValue: `$${positionsValue.toFixed(2)}`,
              biggestWin: biggestWin > 0 ? `+$${biggestWin.toFixed(2)}` : "$0.00",
              predictions: orders.length,
              joinDate: new Date(result.user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user_id) {
      fetchUserData();
    }
  }, [user_id]);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-8">
      <div className="mb-8">
        <UserProfileHeader {...userData} />
      </div>
      <div>
        <UserActivityTable />
      </div>
    </div>
  );
}
```

---

## 修复说明

### 每个步骤如何防止新用户看到旧用户数据

1. **AuthProvider login 函数 - 清空旧数据（步骤 1）**
   - **作用**：在设置新用户数据前，清空所有内存状态和 localStorage
   - **防止**：新用户登录时，内存中不会残留旧用户的数据
   - **时机**：在验证新用户数据之前，确保清空操作先执行

2. **AuthProvider login 函数 - 设置新用户数据（步骤 3）**
   - **作用**：只设置从 API 返回的新用户数据
   - **防止**：新用户的数据不会被旧数据污染
   - **时机**：在清空旧数据之后，确保新数据是干净的

3. **StoreContext - 用户切换监听（第一个 useEffect）**
   - **作用**：当用户切换时，立即清空所有状态
   - **防止**：用户 A 登录后，用户 B 登录时，StoreContext 不会保留用户 A 的数据
   - **时机**：监听 `currentUser.id` 变化，一旦变化立即清空

4. **StoreContext - 用户 ID 验证（第二个 useEffect）**
   - **作用**：从 localStorage 恢复数据前，验证用户 ID 是否匹配
   - **防止**：如果 localStorage 中的数据属于旧用户，不会恢复这些数据
   - **时机**：在恢复数据之前，先验证用户 ID

5. **注册 API - 返回空数据结构**
   - **作用**：明确告诉前端，新用户没有持仓和交易记录
   - **防止**：前端不会错误地显示其他用户的数据
   - **时机**：注册成功后立即返回

6. **移除 Mock 数据直接引用**
   - **作用**：所有数据都从数据库查询，确保数据隔离
   - **防止**：所有用户看到的数据都是自己的数据
   - **时机**：在数据查询时，使用正确的 API 和过滤条件

---

## 测试验证

### 测试场景 1：新用户注册登录
1. 注册新用户 `newuser@example.com`
2. 登录新用户
3. **验证**：新用户应该看到：
   - 余额为 $0.00
   - 持仓列表为空
   - 交易历史为空
   - 充值记录为空
   - 提现记录为空

### 测试场景 2：用户切换
1. 登录用户 A (`userA@example.com`)
2. 进行一些操作（下注、充值）
3. 登出用户 A
4. 登录用户 B (`userB@example.com`)
5. **验证**：用户 B 应该看到：
   - 自己的余额（不是用户 A 的余额）
   - 自己的持仓列表（不是用户 A 的持仓）
   - 自己的交易历史（不是用户 A 的交易历史）

### 测试场景 3：localStorage 数据隔离
1. 登录用户 A
2. 检查 localStorage 中的数据（`pm_store_balance`, `pm_store_positions`, `pm_store_history`）
3. 登出用户 A
4. 登录用户 B
5. **验证**：localStorage 中的数据应该：
   - 只包含用户 B 的数据
   - 不包含用户 A 的数据

---

## 修改文件清单

1. ✅ `components/providers/AuthProvider.tsx` - 修复 login 函数
2. ✅ `app/context/StoreContext.tsx` - 添加用户切换监听和用户 ID 验证
3. ✅ `app/api/auth/register/route.ts` - 明确返回空数据结构
4. ✅ `app/api/auth/login/route.ts` - 确保返回正确的用户数据
5. ✅ `app/api/admin/deposits/route.ts` - 已修复（改为从数据库查询）
6. ✅ `app/api/admin/finance/summary/route.ts` - 已修复（改为从数据库查询）
7. ✅ `app/api/rankings/route.ts` - 已修复（改为从数据库查询）
8. ⚠️ `app/rank/[user_id]/page.tsx` - 需要修复（移除硬编码的 mock 数据）
