# 前端组件修复代码示例

## 1. 修复WalletPage - 移除硬编码，使用API数据

**文件**：`app/wallet/page.tsx`

### 修复前（错误代码）

```typescript
// 第238-243行：硬编码的收益数据
const pnlData = {
  '1D': { value: 150.00, percent: 6.52, isPositive: true },
  '1W': { value: 420.50, percent: 18.2, isPositive: true },
  '1M': { value: -120.30, percent: -4.8, isPositive: false },
  '1Y': { value: 2100.00, percent: 145.0, isPositive: true },
};

const currentPnl = pnlData[timeRange];
```

### 修复后（正确代码）

```typescript
// ========== 修复：从 API 获取资产汇总数据，移除硬编码 ==========
const [assetsData, setAssetsData] = React.useState<{
  availableBalance: number;
  frozenBalance: number;
  positionsValue: number;
  totalBalance: number;
  totalEquity: number;
  historical: {
    '1D': { balance: number; profit: { value: number; percent: number; isPositive: boolean } };
    '1W': { balance: number; profit: { value: number; percent: number; isPositive: boolean } };
    '1M': { balance: number; profit: { value: number; percent: number; isPositive: boolean } };
    '1Y': { balance: number; profit: { value: number; percent: number; isPositive: boolean } };
  };
} | null>(null);
const [isLoadingAssets, setIsLoadingAssets] = React.useState(false);

// 获取资产汇总数据
React.useEffect(() => {
  const fetchAssets = async () => {
    if (!isLoggedIn || !currentUser || !currentUser.id) {
      setAssetsData(null);
      return;
    }

    setIsLoadingAssets(true);
    try {
      const response = await fetch('/api/user/assets', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAssetsData(result.data);
          console.log('💰 [WalletPage] 从 API 获取资产汇总:', result.data);
        } else {
          setAssetsData(null);
        }
      } else {
        setAssetsData(null);
      }
    } catch (error) {
      console.error('❌ [WalletPage] 获取资产汇总失败:', error);
      setAssetsData(null);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  fetchAssets();
}, [isLoggedIn, currentUser, currentUser?.id]);

// ========== 修复：统一资产计算公式 ==========
// totalBalance = availableBalance + frozenBalance + positionsValue
// 优先使用 API 返回的数据
const finalAvailableBalance = assetsData?.availableBalance ?? availableBalance;
const frozenBalance = assetsData?.frozenBalance ?? 0;
const finalPositionsValue = assetsData?.positionsValue ?? positionsValue;
const totalBalance = assetsData?.totalEquity ?? (finalAvailableBalance + frozenBalance + finalPositionsValue);

// ========== 修复：动态计算过去收益，移除硬编码 ==========
const currentPnl = assetsData?.historical[timeRange]?.profit ?? {
  value: 0,
  percent: 0,
  isPositive: true,
};
```

### 修复持仓列表获取

**修复前**：
```typescript
// 从多个数据源获取持仓
const [apiPositions, setApiPositions] = React.useState<any[]>([]);
// 从 /api/orders/user 获取订单，然后手动计算
```

**修复后**：
```typescript
// ========== 修复：从Position API获取持仓，不再从Order计算 ==========
const [positions, setPositions] = React.useState<Array<{
  id: string;
  marketId: string;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  status: 'OPEN' | 'CLOSED';
}>>([]);
const [isLoadingPositions, setIsLoadingPositions] = React.useState(false);

React.useEffect(() => {
  const fetchPositions = async () => {
    if (!isLoggedIn || !currentUser || !currentUser.id) {
      setPositions([]);
      return;
    }

    setIsLoadingPositions(true);
    try {
      const response = await fetch('/api/positions', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // ========== 强制规则：只显示OPEN状态的持仓 ==========
          setPositions(result.data.filter((p: any) => p.status === 'OPEN'));
          console.log('💰 [WalletPage] 从 API 获取持仓:', result.data.length);
        } else {
          setPositions([]);
        }
      } else {
        setPositions([]);
      }
    } catch (error) {
      console.error('❌ [WalletPage] 获取持仓失败:', error);
      setPositions([]);
    } finally {
      setIsLoadingPositions(false);
    }
  };

  fetchPositions();
}, [isLoggedIn, currentUser, currentUser?.id]);
```

---

## 2. 修复TradeSidebar - 禁用已关闭持仓

**文件**：`components/market-detail/TradeSidebar.tsx`

### 修复卖出按钮逻辑

**修复前**：
```typescript
// 不检查status，可以卖出已关闭的持仓
<button onClick={handleSell}>卖出</button>
```

**修复后**：
```typescript
// ========== 修复：检查持仓状态，禁止卖出已关闭的持仓 ==========
const canSell = React.useMemo(() => {
  if (!userPosition) return false;
  
  // ========== 强制规则：只允许卖出OPEN状态的持仓 ==========
  if (userPosition.status !== 'OPEN') {
    return false;
  }
  
  // 检查是否有足够的份额
  const availableShares = selectedOutcome === 'yes' 
    ? userPosition.yesShares 
    : userPosition.noShares;
  
  return availableShares > 0 && amountNum > 0 && amountNum <= availableShares;
}, [userPosition, selectedOutcome, amountNum]);

// 卖出按钮
<button 
  disabled={!canSell || activeTab !== 'sell' || isSubmitting}
  onClick={handleSell}
  className={`
    w-full py-3 px-4 rounded-xl font-bold text-white transition-colors
    ${canSell && activeTab === 'sell' && !isSubmitting
      ? 'bg-pm-red hover:bg-pm-red/90'
      : 'bg-zinc-700 cursor-not-allowed opacity-50'
    }
  `}
>
  {isSubmitting ? '处理中...' : '卖出'}
</button>
```

### 修复卖出API调用

**修复前**：
```typescript
// 可能调用错误的API或没有调用后端
const response = await fetch('/api/orders', { ... });
```

**修复后**：
```typescript
// ========== 修复：调用正确的SELL API ==========
const handleSell = async () => {
  if (!canSell) {
    toast.error('无法卖出', {
      description: '持仓已关闭或份额不足',
    });
    return;
  }

  setIsSubmitting(true);
  try {
    const response = await fetch('/api/orders/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        marketId,
        outcome: selectedOutcome === 'yes' ? 'YES' : 'NO',
        shares: amountNum, // 卖出份额
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      toast.success('卖出成功', {
        description: `已成功卖出 ${amountNum} 份额`,
      });
      
      // 刷新持仓数据
      if (onTradeSuccess) {
        onTradeSuccess({
          updatedMarketPrice: {
            yesPercent: result.data.updatedMarket.totalYes / result.data.updatedMarket.totalVolume * 100,
            noPercent: result.data.updatedMarket.totalNo / result.data.updatedMarket.totalVolume * 100,
          },
          userPosition: {
            outcome: selectedOutcome === 'yes' ? 'YES' : 'NO',
            shares: result.data.position.shares,
            avgPrice: userPosition?.yesAvgPrice || userPosition?.noAvgPrice || 0,
            totalValue: result.data.position.shares * (selectedOutcome === 'yes' ? yesPrice : noPrice),
            status: result.data.position.status, // ========== 修复：传递status字段 ==========
          },
        });
      }
      
      onAmountChange('');
    } else {
      throw new Error(result.error || '卖出失败');
    }
  } catch (error) {
    console.error('卖出失败:', error);
    toast.error('卖出失败', {
      description: error instanceof Error ? error.message : '未知错误',
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## 3. 修复StoreContext - 移除前端模拟交易

**文件**：`app/context/StoreContext.tsx`

### 修复executeTrade函数

**修复前**：
```typescript
const executeTrade = useCallback(async (
  type: 'buy' | 'sell',
  marketId: string,
  outcome: 'YES' | 'NO',
  inputVal: number,
  price: number
) => {
  // 只是前端模拟，没有调用后端
  if (type === 'buy') {
    setBalance(prev => prev - inputVal);
    // ... 前端状态更新
  } else {
    setBalance(prev => prev + netReturn);
    // ... 前端状态更新，但后端不知道
  }
}, []);
```

**修复后**：
```typescript
// ========== 修复：所有交易都通过后端API，不再前端模拟 ==========
const executeTrade = useCallback(async (
  type: 'buy' | 'sell',
  marketId: string,
  outcome: 'YES' | 'NO',
  inputVal: number,
  price: number
) => {
  try {
    // 调用后端API
    const apiEndpoint = type === 'sell' ? '/api/orders/sell' : '/api/orders';
    const requestBody = type === 'sell'
      ? { marketId, outcome, shares: inputVal }
      : { marketId, outcomeSelection: outcome, amount: inputVal };

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '交易失败');
    }

    // 更新余额（从API返回）
    if (result.data?.updatedBalance !== undefined) {
      setBalance(result.data.updatedBalance);
    }

    // 刷新持仓数据（从API获取）
    // 注意：不再手动更新positions，而是从API重新获取
    // 这样可以确保数据一致性

    console.log('✅ [StoreContext] 交易成功:', {
      type,
      marketId,
      outcome,
      updatedBalance: result.data?.updatedBalance,
    });
  } catch (error) {
    console.error('❌ [StoreContext] 交易失败:', error);
    throw error; // 抛出错误，让调用方处理
  }
}, []);
```

---

## 4. 修复UserPositionCard - 检查status

**文件**：`components/market-detail/UserPositionCard.tsx`

### 修复卖出按钮

**修复前**：
```typescript
// 不检查status
<button onClick={onSell}>卖出</button>
```

**修复后**：
```typescript
// ========== 修复：检查持仓状态，禁止卖出已关闭的持仓 ==========
const canSell = position.status === 'OPEN' && position.shares > 0;

<button 
  disabled={!canSell || marketStatus !== 'OPEN'}
  onClick={canSell ? onSell : undefined}
  className={`
    ${canSell && marketStatus === 'OPEN'
      ? 'bg-pm-red hover:bg-pm-red/90'
      : 'bg-zinc-700 cursor-not-allowed opacity-50'
    }
  `}
>
  {position.status === 'CLOSED' ? '已关闭' : '卖出'}
</button>
```

---

## 5. 修复市场详情页 - 使用Position数据

**文件**：`app/markets/[id]/page.tsx`

### 修复持仓显示

**修复前**：
```typescript
// 可能从多个数据源获取持仓
const userPosition = marketData?.userPosition;
```

**修复后**：
```typescript
// ========== 修复：从API返回的Position数据中提取 ==========
// API已修复，现在从Position表查询，返回的数据包含status字段
const userPosition = React.useMemo(() => {
  if (!marketData?.userPosition) return null;
  
  const pos = marketData.userPosition;
  
  // ========== 强制规则：只显示OPEN状态的持仓 ==========
  // 如果yesShares > 0，创建YES持仓对象
  // 如果noShares > 0，创建NO持仓对象
  // 注意：API返回的数据已经是从Position表查询的，包含status信息
  
  return {
    yesShares: pos.yesShares || 0,
    noShares: pos.noShares || 0,
    yesAvgPrice: pos.yesAvgPrice || 0,
    noAvgPrice: pos.noAvgPrice || 0,
    // ========== 修复：添加status字段检查 ==========
    // 注意：API可能返回的是聚合数据，需要根据shares判断status
    // 如果shares > 0，status应该是OPEN
    status: (pos.yesShares > 0 || pos.noShares > 0) ? 'OPEN' : 'CLOSED',
  };
}, [marketData?.userPosition]);
```

---

## 6. 修复持仓列表组件

**文件**：`app/wallet/page.tsx`（持仓列表部分）

### 修复renderPositions函数

**修复前**：
```typescript
// 从storePositions显示，可能包含已关闭的持仓
const positions = useMemo(() => {
  return storePositions.map((pos) => {
    // ... 计算逻辑
  });
}, [storePositions]);
```

**修复后**：
```typescript
// ========== 修复：从API获取持仓，只显示OPEN状态的 ==========
const renderPositions = () => {
  if (isLoadingPositions) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-500 text-sm">加载中...</div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-zinc-500 text-sm">暂无持仓</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-left text-sm text-zinc-400">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
          <tr>
            <th className="px-4 py-3 font-medium">事件</th>
            <th className="px-4 py-3 font-medium text-center">类型</th>
            <th className="px-4 py-3 font-medium text-right">持有份额</th>
            <th className="px-4 py-3 font-medium text-right">均价</th>
            <th className="px-4 py-3 font-medium text-right">当前价值</th>
            <th className="px-4 py-3 font-medium text-right">盈亏</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {positions.map((pos) => (
            <tr key={pos.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-4 text-zinc-200 max-w-[200px] truncate">
                <Link 
                  href={`/markets/${pos.marketId}`}
                  className="hover:text-white hover:underline decoration-zinc-500 underline-offset-4 cursor-pointer transition-colors"
                >
                  {pos.marketTitle}
                </Link>
              </td>
              <td className="px-4 py-4 text-center">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  pos.outcome === 'YES' 
                    ? 'bg-pm-green/20 text-pm-green' 
                    : 'bg-pm-red/20 text-pm-red'
                }`}>
                  {pos.outcome}
                </span>
              </td>
              <td className="px-4 py-4 text-right text-zinc-300 font-mono">
                {pos.shares.toFixed(2)}
              </td>
              <td className="px-4 py-4 text-right font-mono">
                ${pos.avgPrice.toFixed(2)}
              </td>
              <td className="px-4 py-4 text-right text-white font-medium font-mono">
                ${pos.currentValue.toFixed(2)}
              </td>
              <td className={`px-4 py-4 text-right font-medium font-mono ${
                pos.profitLoss >= 0 ? 'text-pm-green' : 'text-pm-red'
              }`}>
                {pos.profitLoss >= 0 ? '+' : ''}
                ${pos.profitLoss.toFixed(2)} (
                {pos.profitLossPercent >= 0 ? '+' : ''}
                {pos.profitLossPercent.toFixed(2)}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 7. 修复资产显示组件

**文件**：`app/wallet/page.tsx`（资产显示部分）

### 修复总资产显示

**修复前**：
```typescript
// 可能从多个数据源计算
const totalBalance = availableBalance + positionsValue;
```

**修复后**：
```typescript
// ========== 修复：统一使用API返回的totalEquity ==========
// totalEquity = availableBalance + frozenBalance + positionsValue
const totalBalance = assetsData?.totalEquity ?? 0;

// 显示
<span className="text-5xl font-bold text-white tracking-tight">
  {formatUSD(totalBalance)}
</span>
```

### 修复收益显示

**修复前**：
```typescript
// 硬编码的收益
const currentPnl = pnlData[timeRange];
```

**修复后**：
```typescript
// ========== 修复：从API获取动态收益 ==========
const currentPnl = assetsData?.historical[timeRange]?.profit ?? {
  value: 0,
  percent: 0,
  isPositive: true,
};

// 显示
<div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-md ${
  currentPnl.isPositive 
    ? 'bg-green-500/10 text-green-400' 
    : 'bg-red-500/10 text-red-400'
}`}>
  {currentPnl.isPositive ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
  ${Math.abs(currentPnl.value).toFixed(2)} ({currentPnl.percent.toFixed(2)}%)
</div>
```

---

## 8. 关键修复点总结

### ✅ 数据源统一

**修复前**：
- WalletPage从多个数据源计算资产
- 市场详情页从Order计算持仓
- 资产估值从Order计算持仓价值
- 持仓列表从Order数组计算

**修复后**：
- ✅ 所有资产数据从 `/api/user/assets` 获取
- ✅ 所有持仓数据从 `/api/positions` 获取
- ✅ 市场详情页持仓从Position表查询
- ✅ 不再从Order数组计算

### ✅ 状态机强制规则

**修复前**：
- 没有Position状态机
- 卖出后持仓仍存在
- 可以重复卖出

**修复后**：
- ✅ Position必须有status字段（OPEN | CLOSED）
- ✅ 卖出后Position.status = CLOSED
- ✅ 前端检查status，禁止卖出已关闭持仓
- ✅ 后端检查status，确保只能卖出OPEN持仓

### ✅ 禁止规则

- ❌ 禁止使用mockData
- ❌ 禁止前端自行计算资产
- ❌ 禁止一个UI用多个口径
- ❌ 禁止SELL不改变position
- ❌ 禁止CLOSED position可操作
