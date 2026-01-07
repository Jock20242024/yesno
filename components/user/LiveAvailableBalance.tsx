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
      const availableBalance = result?.success && result?.data?.availableBalance 
        ? result.data.availableBalance 
        : 0;

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

  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(availableBalance);

  return (
    <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className}`}>
      {formattedBalance}
    </span>
  );
}

