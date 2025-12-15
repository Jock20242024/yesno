'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type Position = {
  marketId: string;
  outcome: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  pnl: number;
};

export type Transaction = {
  id: string;
  date: string;
  marketId: string;
  action: 'Buy' | 'Sell' | 'Redeem';
  outcome: 'YES' | 'NO';
  amount: number;
  shares: number;
  price: number;
  status: 'Success' | 'Pending' | 'Failed';
  txHash?: string;
  pnl?: number;
};

interface StoreContextType {
  balance: number;
  positions: Position[];
  history: Transaction[];
  executeTrade: (type: 'buy' | 'sell', marketId: string, outcome: 'YES' | 'NO', inputVal: number, price: number) => Promise<void>;
  updateBalance: (newBalance: number) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // 1. 初始值必须完全为空/零，保证服务端和客户端HTML完全一致
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);

  // 2. 所有模拟数据必须在 useEffect 内部设置（仅在客户端执行）
  useEffect(() => {
    // 先尝试从 localStorage 恢复数据
    const savedBalance = localStorage.getItem('pm_store_balance');
    const savedPositions = localStorage.getItem('pm_store_positions');
    const savedHistory = localStorage.getItem('pm_store_history');
    
    if (savedBalance) {
      setBalance(parseFloat(savedBalance));
    } else {
      setBalance(2450.32);
    }
    
    if (savedPositions) {
      try {
        const parsed = JSON.parse(savedPositions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPositions(parsed);
        } else {
          setPositions([
            { marketId: '1', outcome: 'YES', shares: 21.15, avgPrice: 0.52, pnl: 0 }
          ]);
        }
      } catch (e) {
        console.error('Failed to parse saved positions', e);
        setPositions([
          { marketId: '1', outcome: 'YES', shares: 21.15, avgPrice: 0.52, pnl: 0 }
        ]);
      }
    } else {
      setPositions([
        { marketId: '1', outcome: 'YES', shares: 21.15, avgPrice: 0.52, pnl: 0 }
      ]);
    }
    
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 修复重复的 id：确保每个 id 都是唯一的
          const seenIds = new Set<string>();
          const fixedHistory = parsed.map((item: Transaction, index: number) => {
            let uniqueId = item.id;
            // 如果 id 已存在或者是无效的，生成新的唯一 id
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
  }, []);

  // 保存到 localStorage（仅在客户端）
  // 使用 useRef 来跟踪上一次的值，避免不必要的写入
  const prevBalanceRef = useRef<number>(0);
  const prevPositionsRef = useRef<string>('');
  const prevHistoryRef = useRef<string>('');
  
  useEffect(() => {
    // 只在值真正变化时才保存
    const balanceChanged = Math.abs(balance - prevBalanceRef.current) > 0.01;
    const positionsStr = JSON.stringify(positions);
    const positionsChanged = positionsStr !== prevPositionsRef.current;
    const historyStr = JSON.stringify(history);
    const historyChanged = historyStr !== prevHistoryRef.current;
    
    if (balanceChanged || positionsChanged || historyChanged) {
      if (balance > 0 || positions.length > 0 || history.length > 0) {
        localStorage.setItem('pm_store_balance', balance.toString());
        localStorage.setItem('pm_store_positions', positionsStr);
        localStorage.setItem('pm_store_history', historyStr);
        
        // 更新 ref
        prevBalanceRef.current = balance;
        prevPositionsRef.current = positionsStr;
        prevHistoryRef.current = historyStr;
      }
    }
  }, [balance, positions, history]);

  // 手续费常量
  const FEE_RATE = 0.02; // 2%

  // 3. 交易逻辑：生成动态数据仅在事件触发后进行，这样是安全的
  const executeTrade = useCallback(async (
    type: 'buy' | 'sell',
    marketId: string,
    outcome: 'YES' | 'NO',
    inputVal: number,
    price: number
  ) => {
    // 调试日志
    console.log('Trade Executed:', type, inputVal, marketId, outcome);
    
    await new Promise(resolve => setTimeout(resolve, 600)); // 模拟延迟

    // 生成动态数据仅在事件触发后进行，这样是安全的
    const now = new Date().toLocaleString('zh-CN');
    // 确保 id 唯一性：使用时间戳 + 随机数
    const txId = 'tx-' + Date.now().toString() + '-' + Math.random().toString(36).slice(2, 9);

    if (type === 'buy') {
      // Buy (买入) 逻辑：
      // 用户输入金额 inputVal (例如 $100)
      // 实际扣款: 扣除 $100
      const cost = inputVal;
      setBalance(prev => prev - cost);
      
      // 计算净投入: netInvest = inputVal * (1 - FEE_RATE) (实际用来买份额的是 $98)
      const netInvest = inputVal * (1 - FEE_RATE);
      // 增加份额: newShares = netInvest / price
      const newShares = netInvest / price;
      
      setPositions(prev => {
        const existing = prev.find(p => p.marketId === marketId && p.outcome === outcome);
        if (existing) {
          const totalShares = existing.shares + newShares;
          // 计算新的平均价格：总成本 / 总份额
          // 总成本 = 原有成本 + 本次投入金额（用于计算均价）
          const totalCost = existing.shares * existing.avgPrice + cost;
          const newAvgPrice = totalCost / totalShares;
          return prev.map(p => 
            p.marketId === marketId && p.outcome === outcome 
              ? { ...p, shares: totalShares, avgPrice: newAvgPrice, pnl: 0 } 
              : p
          );
        }
        // 新建持仓时，平均价格使用实际支付的价格（包含手续费）
        return [...prev, { marketId, outcome, shares: newShares, avgPrice: price, pnl: 0 }];
      });
      
      // 注意：记录到 History 时，Amount 记 $100，但 Shares 是按 $98 算出来的
      setHistory(prev => [{
        id: txId,
        date: now,
        marketId,
        action: 'Buy',
        outcome,
        amount: cost, // 记录用户实际支付的金额
        shares: newShares, // 记录实际获得的份额（已扣除手续费）
        price,
        status: 'Success',
        txHash: '0x' + Math.random().toString(16).slice(2, 10),
        pnl: 0
      }, ...prev]);
    } else {
      // Sell (卖出) 逻辑：
      // 用户输入份额 inputVal (例如 100 份)
      const sharesToSell = inputVal;
      
      // 计算总价值: grossValue = shares * price
      const grossValue = sharesToSell * price;
      // 计算净到手: netReturn = grossValue * (1 - FEE_RATE) (扣除 2% 后才是给用户的钱)
      const netReturn = grossValue * (1 - FEE_RATE);
      
      // 实际加钱: setBalance(prev => prev + netReturn)
      setBalance(prev => prev + netReturn);
      
      setPositions(prev => {
        const existing = prev.find(p => p.marketId === marketId && p.outcome === outcome);
        if (!existing) return prev;
        const remaining = existing.shares - sharesToSell;
        // 计算盈亏：使用净到手金额 - 成本
        const cost = sharesToSell * existing.avgPrice;
        const pnl = netReturn - cost;
        
        if (remaining < 0.001) {
          // 卖光了，只移除对应的 outcome 持仓
          return prev.filter(p => !(p.marketId === marketId && p.outcome === outcome));
        }
        return prev.map(p => 
          p.marketId === marketId && p.outcome === outcome 
            ? { ...p, shares: remaining } 
            : p
        );
      });
      
      // 记录到 History：amount 记录净到手金额，shares 记录卖出的份额
      setHistory(prev => {
        const existing = prev.find(h => h.marketId === marketId && h.outcome === outcome);
        const cost = sharesToSell * (existing?.price || price);
        const pnl = netReturn - cost;
        
        return [{
          id: txId,
          date: now,
          marketId,
          action: 'Sell',
          outcome,
          amount: netReturn, // 记录实际收到的金额（已扣除手续费）
          shares: sharesToSell,
          price,
          status: 'Success',
          txHash: '0x' + Math.random().toString(16).slice(2, 10),
          pnl: pnl
        }, ...prev];
      });
    }
  }, []); // executeTrade 不需要依赖项，因为它使用函数式更新

  const updateBalance = useCallback((newBalance: number) => {
    setBalance(newBalance);
  }, []);

  return (
    <StoreContext.Provider value={{ balance, positions, history, executeTrade, updateBalance }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
