# 资金记录数据隔离完整修复方案

## 问题原因分析

### 核心问题
新用户注册或登录后，交易历史为空，但资金记录（充值/提现）仍显示旧用户数据，导致用户数据隔离失败。

### 根本原因

1. **硬编码的资金记录数据**
   - **文件**：`app/wallet/page.tsx` 第 295-298 行
   - **问题**：`fundings` 数组是硬编码的测试数据，所有用户都会看到相同的数据
   ```typescript
   const fundings = [
     { id: 1, type: '充值', amount: 1000.00, network: 'Polygon (USDC)', status: '成功', time: '2024-12-10 09:30' },
     { id: 2, type: '提现', amount: 200.00, network: 'Ethereum', status: '处理中', time: '2024-12-12 14:20' },
   ];
   ```

2. **登录时未清空资金记录相关的 localStorage**
   - **问题**：虽然清空了 `pm_store_balance`, `pm_store_positions`, `pm_store_history`，但没有清空资金记录相关的数据

3. **资金记录 API 可能未严格按用户过滤**
   - **问题**：需要确认 `/api/transactions` API 是否正确按用户 ID 过滤

4. **useUserTransactions Hook 未监听用户切换**
   - **问题**：`useUserTransactions` Hook 只在组件挂载时获取数据，用户切换时不会重新获取

---

## 修复方案

### 修复 1：AuthProvider login 函数 - 清空资金记录相关的 localStorage

**文件**：`components/providers/AuthProvider.tsx`

**修复内容**：在清空旧数据时，添加资金记录相关的 localStorage key

```typescript
// components/providers/AuthProvider.tsx

const login = (token?: string, userData?: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean }) => {
  // ========== 步骤 1: 清空所有旧用户数据（内存状态 + localStorage）==========
  
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
    
    // ========== 修复：清除资金记录相关的 localStorage ==========
    localStorage.removeItem('pm_fundRecords');
    localStorage.removeItem('pm_deposits');
    localStorage.removeItem('pm_withdrawals');
    
    console.log('🧹 [AuthProvider] 已清空所有旧用户数据（内存状态 + localStorage，包括资金记录）');
  }
  
  // ... 其余登录逻辑
};
```

### 修复 2：StoreContext - 清空资金记录相关的状态

**文件**：`app/context/StoreContext.tsx`

**修复内容**：在用户切换时，清空资金记录相关的状态和 localStorage

```typescript
// app/context/StoreContext.tsx

useEffect(() => {
  // 如果用户切换（currentUser 变为 null 或不同的用户），立即清空所有状态
  if (!currentUser) {
    console.log('🧹 [StoreContext] 用户已登出，清空所有状态（包括资金记录）');
    setBalance(0);
    setPositions([]);
    setHistory([]);
    
    // ========== 修复：清空资金记录相关的 localStorage ==========
    localStorage.removeItem('pm_fundRecords');
    localStorage.removeItem('pm_deposits');
    localStorage.removeItem('pm_withdrawals');
    
    return;
  }
}, [currentUser?.id]);

useEffect(() => {
  // ... 用户 ID 验证逻辑 ...
  
  // ========== 修复：如果用户 ID 不匹配，清空资金记录相关的 localStorage ==========
  if (savedUserId && currentUserId !== savedUserId) {
    // ... 清空其他数据 ...
    
    // 清空资金记录相关的 localStorage
    localStorage.removeItem('pm_fundRecords');
    localStorage.removeItem('pm_deposits');
    localStorage.removeItem('pm_withdrawals');
    
    return;
  }
}, [currentUser?.id]);
```

### 修复 3：WalletPage - 从 API 获取资金记录，移除硬编码数据

**文件**：`app/wallet/page.tsx`

**修复内容**：移除硬编码的 `fundings` 数组，改为从 API 获取

```typescript
// app/wallet/page.tsx

export default function WalletPage() {
  // ... 现有代码 ...
  
  // ========== 修复：从 API 获取资金记录，移除硬编码数据 ==========
  const [fundRecords, setFundRecords] = React.useState<Array<{
    id: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    network: string;
    status: 'completed' | 'pending' | 'failed';
    timestamp: string;
    txHash?: string;
  }>>([]);
  const [isLoadingFundRecords, setIsLoadingFundRecords] = React.useState(false);
  
  // 获取资金记录（充值和提现）
  React.useEffect(() => {
    const fetchFundRecords = async () => {
      // 强制检查：确保 currentUser.id 是从有效的 Auth Token 中动态解析出来的唯一 ID
      if (!isLoggedIn || !currentUser || !currentUser.id) {
        setFundRecords([]);
        return;
      }
      
      // 验证 currentUser.id 是有效的 UUID 格式
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(currentUser.id)) {
        console.error('⚠️ [WalletPage] currentUser.id 格式无效，不是有效的 UUID:', currentUser.id);
        setFundRecords([]);
        return;
      }
      
      // 防止使用默认 ID（如 '1'）
      if (currentUser.id === '1' || currentUser.id === 'default' || currentUser.id.trim() === '') {
        console.error('⚠️ [WalletPage] 检测到无效的 currentUser.id（可能是硬编码的默认值）:', currentUser.id);
        setFundRecords([]);
        return;
      }
      
      setIsLoadingFundRecords(true);
      try {
        const response = await fetch('/api/transactions', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const deposits = result.data.deposits || [];
            const withdrawals = result.data.withdrawals || [];
            
            // 合并充值和提现记录，转换为统一的格式
            const records = [
              ...deposits.map((deposit: any) => ({
                id: deposit.id,
                type: 'deposit' as const,
                amount: Number(deposit.amount),
                network: deposit.network || 'Unknown',
                status: deposit.status.toLowerCase() as 'completed' | 'pending' | 'failed',
                timestamp: deposit.createdAt || deposit.timestamp,
                txHash: deposit.txHash,
              })),
              ...withdrawals.map((withdrawal: any) => ({
                id: withdrawal.id,
                type: 'withdraw' as const,
                amount: Number(withdrawal.amount),
                network: withdrawal.network || 'Unknown',
                status: withdrawal.status.toLowerCase() as 'completed' | 'pending' | 'failed',
                timestamp: withdrawal.createdAt || withdrawal.timestamp,
                txHash: withdrawal.txHash,
              })),
            ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            setFundRecords(records);
            console.log('💰 [WalletPage] 从 API 获取资金记录:', records.length);
          } else {
            setFundRecords([]);
          }
        } else {
          setFundRecords([]);
        }
      } catch (error) {
        console.error('❌ [WalletPage] 获取资金记录失败:', error);
        setFundRecords([]);
      } finally {
        setIsLoadingFundRecords(false);
      }
    };
    
    fetchFundRecords();
  }, [isLoggedIn, currentUser, currentUser?.id]); // 依赖 currentUser.id，确保用户切换时重新获取
  
  // ========== 修复：移除硬编码的 fundings 数组，使用从 API 获取的数据 ==========
  // 删除以下硬编码数据：
  // const fundings = [
  //   { id: 1, type: '充值', amount: 1000.00, network: 'Polygon (USDC)', status: '成功', time: '2024-12-10 09:30' },
  //   { id: 2, type: '提现', amount: 200.00, network: 'Ethereum', status: '处理中', time: '2024-12-12 14:20' },
  // ];
  
  // 转换资金记录格式用于显示
  const fundings = React.useMemo(() => {
    return fundRecords.map((record) => ({
      id: record.id,
      type: record.type === 'deposit' ? '充值' : '提现',
      amount: record.amount,
      network: record.network,
      status: record.status === 'completed' ? '成功' : record.status === 'pending' ? '处理中' : '失败',
      time: new Date(record.timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  }, [fundRecords]);
  
  // 修复 renderFunding 函数
  const renderFunding = () => {
    if (isLoadingFundRecords) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-500 text-sm">加载中...</div>
        </div>
      );
    }
    
    if (fundings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-4">💳</div>
          <p className="text-zinc-500 text-sm">暂无资金记录</p>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto p-4">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">网络</th>
              <th className="px-4 py-3 font-medium text-right">金额</th>
              <th className="px-4 py-3 font-medium text-right">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {fundings.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-4 text-xs font-mono">{item.time}</td>
                <td className="px-4 py-4 text-white font-medium">{item.type}</td>
                <td className="px-4 py-4 text-zinc-400">{item.network}</td>
                <td className={`px-4 py-4 text-right font-bold font-mono ${
                  item.type === '充值' ? 'text-pm-green' : 'text-zinc-200'
                }`}>
                  {item.type === '充值' ? '+' : '-'}${item.amount.toFixed(2)}
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.status === '成功' 
                      ? 'bg-green-500/10 text-green-400' 
                      : item.status === '处理中'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  // ... 其余代码 ...
};
```

### 修复 4：useUserTransactions Hook - 监听用户切换

**文件**：`hooks/useUserTransactions.ts`

**修复内容**：添加用户 ID 依赖，用户切换时重新获取数据

```typescript
// hooks/useUserTransactions.ts

import { useState, useEffect } from 'react';
import { Deposit, Withdrawal } from '@/types/data';
import { useAuth } from '@/components/providers/AuthProvider'; // 导入 useAuth

interface UseUserTransactionsReturn {
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 获取当前用户的交易记录（充值和提现）Hook
 */
export function useUserTransactions(): UseUserTransactionsReturn {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ========== 修复：获取当前用户 ID，监听用户切换 ==========
  const { currentUser, isLoggedIn } = useAuth();

  const fetchTransactions = async () => {
    // ========== 修复：检查用户是否登录 ==========
    if (!isLoggedIn || !currentUser || !currentUser.id) {
      setDeposits([]);
      setWithdrawals([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/transactions', {
        method: 'GET',
        credentials: 'include', // 重要：包含 Cookie
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setDeposits(result.data.deposits || []);
        setWithdrawals(result.data.withdrawals || []);
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error fetching transactions';
      setError(errorMessage);
      console.error('Error fetching user transactions:', err);
      // ========== 修复：出错时清空数据 ==========
      setDeposits([]);
      setWithdrawals([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // ========== 修复：依赖 currentUser.id，用户切换时重新获取 ==========
    fetchTransactions();
  }, [currentUser?.id, isLoggedIn]); // 添加 currentUser.id 和 isLoggedIn 作为依赖

  return {
    deposits,
    withdrawals,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}
```

### 修复 5：注册 API - 明确返回 fundRecords 空数组

**文件**：`app/api/auth/register/route.ts`

**修复内容**：在返回中添加 `fundRecords` 空数组

```typescript
// app/api/auth/register/route.ts

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
  fundRecords: [], // ========== 修复：新用户没有资金记录 ==========
}, { status: 201 });
```

### 修复 6：确认 transactions API 严格按用户过滤

**文件**：`app/api/transactions/route.ts`

**确认**：该 API 已经正确使用 `extractUserIdFromToken()` 和 `DBService.findUserTransactions(userId)`，确保数据隔离。

---

## 修复说明

### 每个步骤如何防止新用户看到旧用户数据

1. **AuthProvider login 函数 - 清空资金记录相关的 localStorage**
   - **作用**：登录新用户前，清空所有可能包含旧用户资金记录的 localStorage
   - **防止**：新用户登录时，localStorage 中不会残留旧用户的资金记录

2. **StoreContext - 清空资金记录相关的状态**
   - **作用**：用户切换时，清空资金记录相关的状态和 localStorage
   - **防止**：用户 A 登录后，用户 B 登录时，StoreContext 不会保留用户 A 的资金记录

3. **WalletPage - 从 API 获取资金记录**
   - **作用**：移除硬编码的测试数据，改为从 API 获取当前用户的真实数据
   - **防止**：所有用户都看到自己的资金记录，而不是硬编码的测试数据

4. **useUserTransactions Hook - 监听用户切换**
   - **作用**：用户切换时，重新从 API 获取资金记录
   - **防止**：用户切换时，Hook 会重新获取新用户的数据，不会保留旧用户的数据

5. **注册 API - 明确返回 fundRecords 空数组**
   - **作用**：明确告诉前端，新用户没有资金记录
   - **防止**：前端不会错误地显示其他用户的数据

6. **transactions API - 严格按用户过滤**
   - **作用**：确保 API 只返回当前用户的数据
   - **防止**：数据库层面的数据隔离，确保查询结果只包含当前用户的数据

---

## 修改文件清单

1. ✅ `components/providers/AuthProvider.tsx` - 添加清空资金记录相关的 localStorage
2. ✅ `app/context/StoreContext.tsx` - 添加清空资金记录相关的状态和 localStorage
3. ✅ `app/wallet/page.tsx` - 移除硬编码数据，改为从 API 获取
4. ✅ `hooks/useUserTransactions.ts` - 添加用户切换监听
5. ✅ `app/api/auth/register/route.ts` - 添加 fundRecords 空数组返回

---

## 测试验证

### 测试场景 1：新用户注册登录
1. 注册新用户 `newuser@example.com`
2. 登录新用户
3. **验证**：新用户应该看到：
   - 资金记录列表为空
   - 没有充值记录
   - 没有提现记录

### 测试场景 2：用户切换
1. 登录用户 A (`userA@example.com`)
2. 进行充值操作
3. 登出用户 A
4. 登录用户 B (`userB@example.com`)
5. **验证**：用户 B 应该看到：
   - 自己的资金记录（如果有）
   - 不包含用户 A 的充值记录
