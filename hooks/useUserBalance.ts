/**
 * 用户余额 SWR Hook
 * 
 * 生产级余额管理方案：
 * - 每 5 秒自动轮询（模拟链上到账等待体验）
 * - 窗口切回来时立即刷新
 * - 支持手动触发刷新（用于充值/提现后立即更新）
 */

import useSWR from 'swr';
import { useAuth } from '@/components/providers/AuthProvider';

const fetcher = async (url: string): Promise<number> => {
  // 给 URL 加上时间戳参数，防止浏览器死缓存
  const timestampedUrl = url + '?t=' + new Date().getTime();
  
  const response = await fetch(timestampedUrl, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store', // 确保不缓存
  });

  if (!response.ok) {
    if (response.status === 401) {
      // 未登录，返回 0
      return 0;
    }
    throw new Error('Failed to fetch balance');
  }

  const data = await response.json();
  const balance = data.balance || 0;
  
  // 调试日志
  console.log('SWR Balance Fetch:', balance);
  
  return balance;
};

export function useUserBalance() {
  const { isLoggedIn } = useAuth();

  const { data, error, isLoading, mutate } = useSWR<number>(
    isLoggedIn ? '/api/user/balance' : null, // 未登录时不请求
    fetcher,
    {
      refreshInterval: 3000, // 每 3 秒轮询一次，模拟即时性
      revalidateOnFocus: true, // 窗口切回来时立即刷新
      revalidateOnReconnect: true, // 网络重连时刷新
      dedupingInterval: 0, // 不做去重，每次都真请求（交易所级别标准）
      errorRetryCount: 3, // 错误重试 3 次
      errorRetryInterval: 2000, // 错误重试间隔 2 秒
      keepPreviousData: true, // 保持上一次数据，避免闪烁
    }
  );

  return {
    balance: data, // 不设置默认值，保持 undefined 状态以便区分加载中和实际为 0
    isLoading,
    isError: !!error,
    error,
    mutate, // 暴露 mutate 方法，用于手动触发刷新
  };
}
