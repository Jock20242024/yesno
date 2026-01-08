/**
 * 统一资产Hook
 * 
 * 确保右上角和交易区使用同一个数据源，避免数据不一致
 */

import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/components/providers/AuthProvider';

export interface AssetsData {
  availableBalance: number; // 可用余额（用户钱包余额）
  frozenBalance: number;    // 冻结资金（待结算订单）
  positionsValue: number;   // 持仓价值
  totalBalance: number;     // 总资产 = availableBalance + frozenBalance + positionsValue
}

const fetcher = async (url: string): Promise<AssetsData> => {
  const timestampedUrl = url + '?t=' + new Date().getTime();
  
  const response = await fetch(timestampedUrl, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch assets');
  }

  const result = await response.json();
  
  if (result.success && result.data) {
    return {
      availableBalance: result.data.availableBalance || 0,
      frozenBalance: result.data.frozenBalance || 0,
      positionsValue: result.data.positionsValue || 0,
      totalBalance: result.data.totalBalance || 0,
    };
  }
  
  return {
    availableBalance: 0,
    frozenBalance: 0,
    positionsValue: 0,
    totalBalance: 0,
  };
};

export function useAssets() {
  const sessionQuery = useSession();
  const status = sessionQuery?.status ?? 'unauthenticated';
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  
  const isAuthenticated = status === 'authenticated';
  const shouldFetch = isAuthenticated && isLoggedIn && !authLoading;

  const { data, error, isLoading, mutate } = useSWR<AssetsData>(
    shouldFetch ? '/api/user/assets' : null,
    fetcher,
    {
      refreshInterval: shouldFetch ? 5000 : 0, // 5秒刷新一次
      revalidateOnFocus: shouldFetch,
      dedupingInterval: 2000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      keepPreviousData: false,
    }
  );

  return {
    assets: data,
    isLoading,
    isError: !!error,
    error,
    mutate, // 暴露 mutate 方法，用于手动触发刷新
  };
}

