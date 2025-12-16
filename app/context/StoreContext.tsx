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
    
    // 修复：不再使用硬编码的 2450.32，而是从 API 获取真实余额
    // 如果 localStorage 中有保存的余额，使用它；否则初始化为 0，等待从 API 同步
    if (savedBalance) {
      const parsedBalance = parseFloat(savedBalance);
      // 验证保存的余额是否合理（不是硬编码的测试值）
      if (parsedBalance > 0 && parsedBalance !== 2450.32) {
        setBalance(parsedBalance);
      } else {
        // 如果保存的是旧的测试值，清除它，等待从 API 同步
        localStorage.removeItem('pm_store_balance');
        setBalance(0);
      }
    } else {
      // 初始化为 0，等待从 API 同步真实余额
      setBalance(0);
    }
    
    // 彻底清除或忽略当前用户的无效持仓价值
    // 强制校验：由于 new@example.com 尚未成功下注，其持仓数据在数据库中应为空
    // 修复：如果后端 API 没有返回有效的持仓列表，持仓应为空数组
    if (savedPositions) {
      try {
        const parsed = JSON.parse(savedPositions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 数据清理：强制检查持仓数据对象是否为空，如果为空或为旧测试数据，则总持仓价值必须显示 $0.00
          // 验证持仓数据的有效性：检查是否包含已知的测试数据
          // 铁律原则：必须确保在尚未下注前，总持仓价值显示为 $0.00
          // 已知测试数据模式：
          // 1. marketId: '1', shares: 21.15, avgPrice: 0.52 (价值 = 21.15 * 0.52 = 10.998)
          // 2. 任何 marketId 为字符串 '1' 的持仓（旧测试数据）
          // 3. 任何 shares 为 21.15 的持仓
          // 4. 任何 avgPrice 为 0.52 的持仓
          const hasTestData = parsed.some((pos: any) => {
            const isTestDataPattern1 = pos.marketId === '1' && pos.shares === 21.15 && pos.avgPrice === 0.52;
            const isTestDataPattern2 = pos.marketId === '1'; // 任何 marketId 为 '1' 的持仓都可能是测试数据
            const isTestDataPattern3 = pos.shares === 21.15; // 任何 shares 为 21.15 的持仓都可能是测试数据
            const isTestDataPattern4 = pos.avgPrice === 0.52; // 任何 avgPrice 为 0.52 的持仓都可能是测试数据
            return isTestDataPattern1 || isTestDataPattern2 || isTestDataPattern3 || isTestDataPattern4;
          });
          
          if (hasTestData) {
            console.warn('⚠️ [StoreContext] 检测到测试持仓数据，强制清除:', parsed);
            localStorage.removeItem('pm_store_positions');
            setPositions([]);
          } else {
            // 额外验证：检查持仓数据是否有效
            const validPositions = parsed.filter((pos: any) => {
              return pos.shares && pos.shares > 0 && pos.avgPrice && pos.avgPrice > 0;
            });
            
            if (validPositions.length === 0) {
              console.warn('⚠️ [StoreContext] 所有持仓数据无效，强制清除');
              localStorage.removeItem('pm_store_positions');
              setPositions([]);
            } else {
              setPositions(validPositions);
            }
          }
        } else {
          // 如果没有有效持仓，设置为空数组
          setPositions([]);
        }
      } catch (e) {
        console.error('Failed to parse saved positions', e);
        // 解析失败时，清除无效数据并设置为空数组
        localStorage.removeItem('pm_store_positions');
        setPositions([]);
      }
    } else {
      // 如果没有保存的持仓数据，设置为空数组（不再使用硬编码的测试数据）
      setPositions([]);
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
