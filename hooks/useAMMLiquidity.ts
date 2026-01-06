/**
 * 🔥 AMM流动性Hook
 * 
 * 功能：
 * 1. 根据当前池子YES/NO数量计算不同价位的"可成交深度"
 * 2. 实时获取AMM虚拟订单数据
 * 3. 计算价格滑点
 */

import { useState, useEffect, useCallback } from 'react';
import { Outcome } from '@/types/data';

interface AMMDepthPoint {
  price: number;
  depth: number;
  outcome: Outcome;
}

interface AMMLiquidityData {
  totalYes: number;
  totalNo: number;
  currentPrice: number;
  depth: AMMDepthPoint[];
  k: number; // 恒定乘积常数
}

/**
 * 计算AMM可成交深度
 */
function calculateAMMDepth(
  totalYes: number,
  totalNo: number,
  priceLevels: number[] = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
): AMMDepthPoint[] {
  const depth: AMMDepthPoint[] = [];
  const k = totalYes * totalNo;

  for (const price of priceLevels) {
    try {
      // 计算在该价格下可以买入多少
      const testAmount = 100; // 测试金额
      const outcome = price <= 0.5 ? Outcome.NO : Outcome.YES;
      
      // 使用CPMM公式计算
      if (totalYes <= 0 && totalNo <= 0) {
        depth.push({ price, depth: 0, outcome });
        continue;
      }

      let shares = 0;
      if (outcome === Outcome.YES) {
        const newTotalNo = totalNo + testAmount;
        if (newTotalNo > 0 && k > 0) {
          shares = totalYes - (k / newTotalNo);
          if (shares <= 0 || shares > totalYes || !isFinite(shares)) {
            shares = testAmount / Math.max(0.01, price);
          }
        } else {
          shares = testAmount / Math.max(0.01, price);
        }
      } else {
        const newTotalYes = totalYes + testAmount;
        if (newTotalYes > 0 && k > 0) {
          shares = totalNo - (k / newTotalYes);
          if (shares <= 0 || shares > totalNo || !isFinite(shares)) {
            shares = testAmount / Math.max(0.01, price);
          }
        } else {
          shares = testAmount / Math.max(0.01, price);
        }
      }

      const depthAtPrice = shares * (price / Math.max(0.01, price));
      depth.push({ price, depth: Math.max(0, depthAtPrice), outcome });
    } catch (error) {
      depth.push({ price, depth: 0, outcome: Outcome.YES });
    }
  }

  return depth;
}

/**
 * 计算价格滑点
 */
function calculateSlippage(
  totalYes: number,
  totalNo: number,
  outcome: Outcome,
  amount: number
): { executionPrice: number; slippage: number; shares: number } {
  const totalLiquidity = totalYes + totalNo;
  const currentPrice = totalLiquidity > 0
    ? (outcome === Outcome.YES ? totalYes / totalLiquidity : totalNo / totalLiquidity)
    : 0.5;

  // 使用CPMM计算实际成交价格
  const k = totalYes * totalNo;
  let shares = 0;
  let newTotalYes = totalYes;
  let newTotalNo = totalNo;

  if (outcome === Outcome.YES) {
    const newTotalNoAfter = totalNo + amount;
    if (newTotalNoAfter > 0 && k > 0) {
      shares = totalYes - (k / newTotalNoAfter);
      if (shares <= 0 || shares > totalYes || !isFinite(shares)) {
        shares = amount / Math.max(0.01, currentPrice);
      }
      newTotalYes = totalYes - shares;
      newTotalNo = newTotalNoAfter;
    } else {
      shares = amount / Math.max(0.01, currentPrice);
      newTotalYes = Math.max(0, totalYes - shares);
      newTotalNo = totalNo + amount;
    }
  } else {
    const newTotalYesAfter = totalYes + amount;
    if (newTotalYesAfter > 0 && k > 0) {
      shares = totalNo - (k / newTotalYesAfter);
      if (shares <= 0 || shares > totalNo || !isFinite(shares)) {
        shares = amount / Math.max(0.01, currentPrice);
      }
      newTotalYes = newTotalYesAfter;
      newTotalNo = totalNo - shares;
    } else {
      shares = amount / Math.max(0.01, currentPrice);
      newTotalYes = totalYes + amount;
      newTotalNo = Math.max(0, totalNo - shares);
    }
  }

  const executionPrice = shares > 0 ? amount / shares : currentPrice;
  const slippage = executionPrice > 0 ? ((executionPrice - currentPrice) / currentPrice) * 100 : 0;

  return { executionPrice, slippage, shares };
}

/**
 * useAMMLiquidity Hook
 * 
 * @param marketId 市场ID
 * @param refreshInterval 刷新间隔（毫秒，默认5000）
 */
export function useAMMLiquidity(
  marketId: string | null,
  refreshInterval: number = 5000
): {
  data: AMMLiquidityData | null;
  isLoading: boolean;
  error: string | null;
  calculateSlippageForAmount: (outcome: Outcome, amount: number) => { executionPrice: number; slippage: number; shares: number };
} {
  const [data, setData] = useState<AMMLiquidityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAMMLiquidity = useCallback(async () => {
    if (!marketId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/markets/${marketId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Invalid market data');
      }

      const market = result.data;
      const totalYes = market.totalYes || 0;
      const totalNo = market.totalNo || 0;
      const k = totalYes * totalNo;
      const totalLiquidity = totalYes + totalNo;
      const currentPrice = totalLiquidity > 0 ? totalYes / totalLiquidity : 0.5;

      const depth = calculateAMMDepth(totalYes, totalNo);

      setData({
        totalYes,
        totalNo,
        currentPrice,
        depth,
        k,
      });

      setError(null);
    } catch (err) {
      console.error('Failed to fetch AMM liquidity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch AMM liquidity');
    } finally {
      setIsLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchAMMLiquidity();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchAMMLiquidity, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAMMLiquidity, refreshInterval]);

  const calculateSlippageForAmount = useCallback((outcome: Outcome, amount: number) => {
    if (!data) {
      return { executionPrice: 0.5, slippage: 0, shares: 0 };
    }

    return calculateSlippage(data.totalYes, data.totalNo, outcome, amount);
  }, [data]);

  return {
    data,
    isLoading,
    error,
    calculateSlippageForAmount,
  };
}

