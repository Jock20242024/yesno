"use client";

/**
 * LiveAvailableBalance - 实时可用余额显示组件
 * 
 * 🔥 关键修复：与交易区使用相同的数据源
 * - 使用 /api/user/assets 的 availableBalance
 * - 与交易区显示一致，确保数据同步
 */

import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/components/providers/AuthProvider';

interface LiveAvailableBalanceProps {
  className?: string;
}

export default function LiveAvailableBalance({ className = "" }: LiveAvailableBalanceProps) {
  const sessionQuery = useSession();
  const session = sessionQuery?.data ?? null;
  const status = sessionQuery?.status ?? 'unauthenticated';
  const { isLoggedIn, isLoading: authLoading, handleApiGuestResponse } = useAuth();

  const isAuthenticated = status === 'authenticated';
  const shouldFetch = isAuthenticated && isLoggedIn && !authLoading;

  const fetcher = async (url: string): Promise<number> => {
    try {
      const timestampedUrl = url + '?t=' + new Date().getTime();
      const response = await fetch(timestampedUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok && response.status === 401) {
        if (handleApiGuestResponse(response)) {
          return -1;
        }
        return 0;
      }

      if (!response.ok) {
        return 0;
      }

      const result = await response.json();

      if (handleApiGuestResponse(response, result)) {
        return -1;
      }
      
      // 🔥 关键修复：返回 availableBalance（可用余额），不是 totalBalance
      // 🔥 强化数据安全性：添加防御性代码，确保不是 NaN
      const rawAvailableBalance = result?.success && result?.data?.availableBalance 
        ? result.data.availableBalance 
        : 0;
      
      // 🔥 防御性代码：确保不是 NaN 或 Infinity
      const availableBalance = Number(rawAvailableBalance || 0);
      if (isNaN(availableBalance) || !isFinite(availableBalance)) {
        console.warn('⚠️ [LiveAvailableBalance] 检测到无效的 availableBalance:', rawAvailableBalance);
        return 0;
      }

      return availableBalance;
    } catch (error) {
      console.error('💰 [LiveAvailableBalance] Fetcher error:', error);
      return 0;
    }
  };

  const { data: availableBalance, isLoading } = useSWR<number>(
    shouldFetch ? '/api/user/assets' : null,
    fetcher,
    {
      refreshInterval: shouldFetch ? 5000 : 0,
      revalidateOnFocus: shouldFetch,
      dedupingInterval: 2000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      keepPreviousData: false,
    }
  );

  if (status === 'loading' || authLoading) {
    return null;
  }
  
  if (status === 'unauthenticated' || !isAuthenticated || !isLoggedIn) {
    return null;
  }

  if (availableBalance === undefined || isLoading) {
    return (
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className} animate-pulse`}>
        <span className="opacity-50">...</span>
      </span>
    );
  }

  if (availableBalance === -1) {
    return (
      <span className={`text-xs font-medium text-yellow-400 leading-none ${className}`}>
        需要重新登录
      </span>
    );
  }

  // 🔥 强化数据安全性：确保 availableBalance 是有效数字
  const safeBalance = Number(availableBalance || 0);
  const finalBalance = (isNaN(safeBalance) || !isFinite(safeBalance)) ? 0 : safeBalance;

  // 🔥 确保在 API 请求完成前显示 0.00 而不是 NaN
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(finalBalance);

  // 格式化拆解数据
  const formatCurrency = (amount: number) => {
    const safeAmount = Number(amount || 0);
    const finalAmount = (isNaN(safeAmount) || !isFinite(safeAmount)) ? 0 : safeAmount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(finalAmount);
  };

  // 🔥 新增：添加 Tooltip 显示资产拆解
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className} cursor-help`}>
        {formattedBalance}
      </span>
      
      {/* 🔥 新增：Tooltip 显示资产拆解 */}
      {showTooltip && assets && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            资产拆解
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🟢 可用余额</span>
            <span className="text-xs font-bold text-white font-mono tabular-nums">
              {formatCurrency(assets.availableBalance)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🔵 持仓价值</span>
            <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
              {formatCurrency(assets.positionsValue)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🔴 冻结资金</span>
            <span className="text-xs font-bold text-zinc-300 font-mono tabular-nums">
              {formatCurrency(assets.frozenBalance)}
            </span>
          </div>
          
          <div className="border-t border-white/10 pt-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">总资产</span>
              <span className="text-xs font-black text-white font-mono tabular-nums">
                {formatCurrency(assets.totalBalance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

