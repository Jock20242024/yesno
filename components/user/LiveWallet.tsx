"use client";

/**
 * LiveWallet - 实时总资产显示组件
 * 
 * 🔥 关键修复：统一数据源
 * - 不再使用 /api/user/balance（只返回可用余额）
 * - 改用 /api/user/assets（返回总资产 totalBalance）
 * - 与主页面（WalletPage）使用相同的数据源，确保数据一致
 */

import useSWR from 'swr';
import { useAuth } from '@/components/providers/AuthProvider';

interface AssetsData {
  availableBalance: number;
  frozenBalance: number;
  positionsValue: number;
  totalBalance: number;
  totalEquity: number;
}

const fetcher = async (url: string): Promise<number> => {
  try {
    // 给 URL 加上时间戳参数，防止浏览器死缓存
    const timestampedUrl = url + '?t=' + new Date().getTime();
    
    console.log('💰 [LiveWallet] Fetching total balance from:', timestampedUrl);
    
    // 🔥 彻底对齐数据：使用与 Dashboard 完全一致的 headers
    const response = await fetch(timestampedUrl, {
      method: 'GET',
      credentials: 'include', // 与 Dashboard 一致：包含 Cookie
      cache: 'no-store', // 与 Dashboard 一致：禁用缓存
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('💰 [LiveWallet] Response status:', response.status, response.statusText);

    if (!response.ok) {
      if (response.status === 401) {
        console.log('💰 [LiveWallet] Unauthorized, returning 0');
        return 0;
      }
      const errorText = await response.text();
      console.error('💰 [LiveWallet] Fetch failed:', response.status, errorText);
      return 0; // 发生错误时返回 0，避免 SWR 停止重试
    }

    const result = await response.json();
    console.log('💰 [LiveWallet] Fetched assets data:', result);
    
    // 🔥 关键修复：从 /api/user/assets 获取 totalBalance（总资产）
    // 这与 WalletPage 主页面使用相同的数据源，确保数据一致
    const totalBalance = result?.success && result?.data?.totalBalance 
      ? result.data.totalBalance 
      : 0;
    
    console.log('💰 [LiveWallet] Parsed totalBalance:', totalBalance);
    
    return totalBalance;
  } catch (error) {
    console.error('💰 [LiveWallet] Fetcher error:', error);
    // 发生错误时返回 0，而不是抛出异常，避免 SWR 停止重试
    return 0;
  }
};

interface LiveWalletProps {
  className?: string;
}

export default function LiveWallet({ className = "" }: LiveWalletProps) {
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  // 🔥 架构修复：不要在 authLoading 为 true 时就去解析余额
  // 只有当 isLoggedIn 为 true 时才发起请求
  const shouldFetch = isLoggedIn && !authLoading;

  // 🔥 关键修复：使用 /api/user/assets 获取总资产，与主页面数据源一致
  const { data: totalBalance, isLoading, error } = useSWR<number>(
    shouldFetch ? '/api/user/assets' : null,
    fetcher,
    {
      refreshInterval: shouldFetch ? 5000 : 0, // 5秒刷新一次（资产数据不需要太频繁）
      revalidateOnFocus: shouldFetch, // 聚焦时刷新
      dedupingInterval: 2000, // 2秒内去重，避免重复请求
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      keepPreviousData: true,
    }
  );

  // 调试日志
  console.log('💰 [LiveWallet] Total balance state:', { totalBalance, isLoading, error, isLoggedIn, authLoading, shouldFetch });

  // 🔥 架构修复：只有当 isLoggedIn 且 totalBalance 不为 undefined 时才渲染数值，否则显示 Loading
  if (authLoading || !isLoggedIn) {
    // 认证加载中或未登录：显示 Loading
    return (
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight ${className} animate-pulse`}>
        <span className="opacity-50">...</span>
      </span>
    );
  }

  // 🔥 架构修复：只有当 isLoggedIn 且 totalBalance 不为 undefined 时才渲染数值
  if (totalBalance === undefined || isLoading) {
    // 数据加载中：显示 Loading
    return (
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight ${className} animate-pulse`}>
        <span className="opacity-50">...</span>
      </span>
    );
  }

  // 🔥 架构修复：只有当 isLoggedIn 且 totalBalance 不为 undefined 时才渲染数值
  // totalBalance 可以是 0，但不能是 undefined
  const displayBalance = totalBalance;
  
  // 格式化余额显示
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayBalance);

  // 显示状态：格式化后的余额（强制显示，即使是 0 也要显示）
  console.log('💰 [LiveWallet] Rendering balance:', displayBalance, formattedBalance);
  return (
    <span className={`text-sm font-black text-white leading-none font-mono tracking-tight ${className}`}>
      {formattedBalance}
    </span>
  );
}
