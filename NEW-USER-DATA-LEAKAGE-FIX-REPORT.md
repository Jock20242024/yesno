# 新用户数据泄漏问题分析与修复报告

## 问题描述

新用户注册登录后，会看到已有持仓和充提记录。这是一个严重的数据隔离问题。

---

## 问题原因分析

### 1. Mock 数据共享问题

**问题文件**：
- `app/api/admin/deposits/route.ts` - 使用不存在的 `mockDeposits`
- `app/api/admin/finance/summary/route.ts` - 使用不存在的 `mockDeposits` 和 `mockWithdrawals`
- `app/api/rankings/route.ts` - 使用不存在的 `mockUsers`

**问题原因**：
- `lib/mockData.ts` 只是重新导出 `dbService`，不包含 `mockDeposits`、`mockWithdrawals`、`mockUsers` 等
- 这些 API 尝试导入不存在的 mock 数据，可能导致运行时错误或返回空数据
- 即使存在 mock 数据，也会导致所有用户看到相同的数据

### 2. 前端状态未清空

**问题文件**：
- `components/providers/AuthProvider.tsx` - 登录时没有清空 StoreContext 的 localStorage 数据
- `app/context/StoreContext.tsx` - 从 localStorage 恢复数据时，没有检查是否是当前用户的数据

**问题原因**：
- 登录新用户时，`AuthProvider` 只清除了 `pm_currentUser` 和 `pm_user`，但没有清除 `pm_store_balance`、`pm_store_positions`、`pm_store_history`
- `StoreContext` 从 localStorage 恢复数据时，没有验证这些数据是否属于当前用户
- 导致新用户看到旧用户在 localStorage 中保存的数据

### 3. 注册时数据初始化

**问题文件**：
- `app/api/auth/register/route.ts` - 注册时只创建用户，没有显式创建空的 positions、deposits、withdrawals

**问题原因**：
- 虽然新用户注册时数据库中没有订单记录（positions、deposits、withdrawals 会自动为空），但前端可能从 localStorage 恢复了旧数据

---

## 修复方案

### 修复 1：修复 Admin API 使用 Mock 数据的问题

**文件**：`app/api/admin/deposits/route.ts`

**问题**：使用不存在的 `mockDeposits`

**修复**：改为从数据库查询所有充值记录（管理员可以查看所有用户的充值）

```typescript
// 修复前
import { mockDeposits } from "@/lib/mockData";
let filteredDeposits = [...mockDeposits];

// 修复后
import { DBService } from '@/lib/dbService';
// 管理员可以查看所有充值记录（不按用户过滤）
const allDeposits = await DBService.findPendingWithdrawals(); // 需要添加新方法
// 或者使用 Prisma 直接查询
```

### ✅ 修复 3：登录时清空旧用户的 Context 状态和 localStorage

**文件**：`components/providers/AuthProvider.tsx`

**已修复**：在 `login` 函数开头，清空所有可能包含旧用户数据的 localStorage 项

**关键修复点**：
```typescript
const login = (token?: string, userData?: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean }) => {
  // 修复：登录新用户前，清空旧用户的 Context 状态和 localStorage
  if (typeof window !== 'undefined') {
    // 清除 StoreContext 的数据（防止新用户看到旧用户的数据）
    localStorage.removeItem('pm_store_balance');
    localStorage.removeItem('pm_store_positions');
    localStorage.removeItem('pm_store_history');
    
    // 清除旧用户的认证数据（会在下面重新设置）
    localStorage.removeItem('pm_currentUser');
    localStorage.removeItem('pm_user');
    
    console.log('🧹 [AuthProvider] 登录新用户前，已清除所有旧用户的 localStorage 数据');
  }
  
  // ... 其余登录逻辑
}
```

### ✅ 修复 4：StoreContext 添加用户 ID 检查

**文件**：`app/context/StoreContext.tsx`

**已修复**：从 localStorage 恢复数据前，检查用户 ID 是否匹配

**关键修复点**：
```typescript
import { useAuth } from '@/components/providers/AuthProvider'; // 导入 useAuth

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth(); // 获取当前用户
  
  useEffect(() => {
    // 修复：检查 localStorage 中保存的用户 ID 是否与当前用户匹配
    const savedCurrentUser = localStorage.getItem('pm_currentUser');
    const parsedCurrentUser = savedCurrentUser ? JSON.parse(savedCurrentUser) : null;
    const savedUserId = parsedCurrentUser?.id;
    const currentUserId = currentUser?.id;
    
    // 如果用户 ID 不匹配，清除所有 StoreContext 数据
    if (currentUserId && savedUserId && currentUserId !== savedUserId) {
      console.warn('⚠️ [StoreContext] 检测到用户切换，清除旧用户数据', {
        currentUserId,
        savedUserId,
      });
      localStorage.removeItem('pm_store_balance');
      localStorage.removeItem('pm_store_positions');
      localStorage.removeItem('pm_store_history');
      setBalance(0);
      setPositions([]);
      setHistory([]);
      return; // 不恢复旧数据
    }
    
    // 只有在用户 ID 匹配或没有当前用户时才恢复数据
    // ... 其余恢复逻辑
  }, [currentUser?.id]); // 依赖 currentUser.id，确保用户切换时重新执行
}
```

### 修复 4：确保新用户注册时创建空的数据

**文件**：`app/api/auth/register/route.ts`

**问题**：注册时只创建用户，没有显式说明 positions、deposits、withdrawals 为空

**修复**：虽然新用户注册时数据库中没有订单记录（positions、deposits、withdrawals 会自动为空），但需要确保前端不会从 localStorage 恢复旧数据

---

## 修复代码

### ✅ 修复 1：修复 Admin API 使用 Mock 数据

**文件**：`app/api/admin/deposits/route.ts`

**已修复**：改为从数据库查询所有充值记录（管理员可以查看所有用户的充值）

**关键修复点**：
- 移除了 `import { mockDeposits } from "@/lib/mockData"`
- 改为使用 `prisma.deposit.findMany()` 从数据库查询
- 关联 User 表获取 email 作为 username
- 支持搜索、状态过滤和分页

### ✅ 修复 2：修复 Admin Finance Summary API

**文件**：`app/api/admin/finance/summary/route.ts`

**已修复**：改为从数据库查询所有充值和提现记录

**关键修复点**：
- 移除了 `import { mockDeposits, mockWithdrawals } from "@/lib/mockData"`
- 改为使用 `prisma.deposit.findMany()` 和 `prisma.withdrawal.findMany()` 从数据库查询
- 支持时间范围过滤
- 修复了 `generateTrendData` 函数的类型定义

### 修复 2：登录时清空旧用户的 Context 状态和 localStorage

**文件**：`components/providers/AuthProvider.tsx`

**修复代码**：
```typescript
// Login 函数：接收 user 数据（Token 现在在 HttpOnly Cookie 中）
const login = (token?: string, userData?: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean }) => {
  // 修复：登录新用户前，清空旧用户的 Context 状态和 localStorage
  // 清除所有可能包含旧用户数据的 localStorage 项
  if (typeof window !== 'undefined') {
    // 清除 StoreContext 的数据
    localStorage.removeItem('pm_store_balance');
    localStorage.removeItem('pm_store_positions');
    localStorage.removeItem('pm_store_history');
    
    // 清除旧用户的认证数据（会在下面重新设置）
    localStorage.removeItem('pm_currentUser');
    localStorage.removeItem('pm_user');
  }
  
  if (userData) {
    // ... 其余登录逻辑
  }
  
  setIsLoggedIn(true);
};
```

### 修复 3：StoreContext 添加用户 ID 检查

**文件**：`app/context/StoreContext.tsx`

**修复代码**：
```typescript
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  
  // 获取当前用户 ID（从 AuthProvider）
  const { currentUser } = useAuth(); // 需要从 AuthProvider 获取 currentUser

  useEffect(() => {
    // 修复：检查 localStorage 中保存的用户 ID 是否与当前用户匹配
    const savedCurrentUser = localStorage.getItem('pm_currentUser');
    const parsedCurrentUser = savedCurrentUser ? JSON.parse(savedCurrentUser) : null;
    const savedUserId = parsedCurrentUser?.id;
    const currentUserId = currentUser?.id;
    
    // 如果用户 ID 不匹配，清除所有 StoreContext 数据
    if (currentUserId && savedUserId && currentUserId !== savedUserId) {
      console.warn('⚠️ [StoreContext] 检测到用户切换，清除旧用户数据', {
        currentUserId,
        savedUserId,
      });
      localStorage.removeItem('pm_store_balance');
      localStorage.removeItem('pm_store_positions');
      localStorage.removeItem('pm_store_history');
      setBalance(0);
      setPositions([]);
      setHistory([]);
      return; // 不恢复旧数据
    }
    
    // 只有在用户 ID 匹配时才恢复数据
    // ... 其余恢复逻辑
  }, [currentUser?.id]); // 依赖 currentUser.id，确保用户切换时重新执行
}
```

### 修复 4：确保注册时返回空的数据结构

**文件**：`app/api/auth/register/route.ts`

**修复代码**：
```typescript
// 注册成功后，确保返回的用户数据结构明确
return NextResponse.json({
  success: true,
  message: 'User registered successfully',
  user: {
    id: newUser.id,
    email: newUser.email,
    balance: newUser.balance, // 明确返回初始余额 0
    // 不返回密码信息
  },
  // 明确说明新用户没有持仓和交易记录
  positions: [], // 新用户没有持仓
  deposits: [], // 新用户没有充值记录
  withdrawals: [], // 新用户没有提现记录
}, { status: 201 });
```

---

## 修复说明

### 1. Mock 数据共享问题

- **原因**：Admin API 使用不存在的 mock 数据
- **修复**：改为从数据库查询真实数据
- **影响**：管理员可以正确查看所有用户的充值记录

### 2. 前端状态未清空

- **原因**：登录新用户时，没有清空 StoreContext 的 localStorage 数据
- **修复**：在 `login` 函数中，清空所有可能包含旧用户数据的 localStorage 项
- **影响**：新用户登录时不会看到旧用户的数据

### 3. StoreContext 用户 ID 检查

- **原因**：从 localStorage 恢复数据时，没有检查是否是当前用户的数据
- **修复**：在恢复数据前，检查 localStorage 中保存的用户 ID 是否与当前用户匹配
- **影响**：确保只恢复当前用户的数据

### 4. 注册时数据初始化

- **原因**：虽然数据库中没有订单记录，但前端可能从 localStorage 恢复旧数据
- **修复**：在注册 API 返回中明确说明新用户没有持仓和交易记录
- **影响**：前端可以正确初始化新用户的状态

---

## 测试建议

1. **测试新用户注册**：
   - 注册新用户
   - 验证新用户没有持仓和交易记录
   - 验证新用户余额为 0

2. **测试用户切换**：
   - 登录用户 A
   - 进行一些操作（下注、充值）
   - 登出
   - 登录用户 B
   - 验证用户 B 看不到用户 A 的数据

3. **测试 localStorage 清理**：
   - 登录用户 A
   - 检查 localStorage 中的数据
   - 登出
   - 登录用户 B
   - 验证 localStorage 中只有用户 B 的数据
