"use client";

/**
 * LiveWallet - 实时总资产显示组件
 * 
 * 🔥 关键修复：统一数据源
 * - 不再使用 /api/user/balance（只返回可用余额）
 * - 改用 /api/user/assets（返回总资产 totalBalance）
 * - 与主页面（WalletPage）使用相同的数据源，确保数据一致
 * 
 * 🔥 状态硬隔离：必须基于 NextAuth 的 status === 'authenticated' 决定是否渲染
 * - 未认证时，必须销毁所有 DOM 节点，不显示任何内容（包括 $0.00 占位符）
 */

import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/components/providers/AuthProvider';

interface AssetsData {
  availableBalance: number;
  frozenBalance: number;
  positionsValue: number;
  totalBalance: number;
  totalEquity: number;
}

interface LiveWalletProps {
  className?: string;
}

export default function LiveWallet({ className = "" }: LiveWalletProps) {
  // 🔥 状态硬隔离：使用 NextAuth 的 useSession 作为唯一认证源
  // 🔥 修复：安全处理 useSession，防止服务端渲染时返回 undefined
  const sessionQuery = useSession();
  const session = sessionQuery?.data ?? null;
  const status = sessionQuery?.status ?? 'unauthenticated';
  const { isLoggedIn, isLoading: authLoading, logout, handleApiGuestResponse } = useAuth();

  // 🔥 核心逻辑：必须 status === 'authenticated' 才渲染组件
  // 未认证时，必须销毁所有 DOM 节点，不显示任何内容
  const isAuthenticated = status === 'authenticated';
  
  // 🔥 架构修复：不要在 authLoading 为 true 时就去解析余额
  // 只有当 NextAuth 认证且 isLoggedIn 为 true 时才发起请求
  const shouldFetch = isAuthenticated && isLoggedIn && !authLoading;

  // 🔥 修复：检测 isGuest: true，强制触发退出登录
  // fetcher 必须放在组件内部，以便访问 logout 函数
  const fetcher = async (url: string): Promise<number> => {
    try {
      // 给 URL 加上时间戳参数，防止浏览器死缓存
      const timestampedUrl = url + '?t=' + new Date().getTime();

      // 🔥 彻底对齐数据：使用与 Dashboard 完全一致的 headers
      const response = await fetch(timestampedUrl, {
        method: 'GET',
        credentials: 'include', // 与 Dashboard 一致：包含 Cookie
        cache: 'no-store', // 与 Dashboard 一致：禁用缓存
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // 🔥 修复：统一使用 AuthProvider 的 handleApiGuestResponse 处理 isGuest/401
      // 先处理响应状态，检测 401 或 isGuest
      if (!response.ok && response.status === 401) {
        // 401 状态码，先调用 handleApiGuestResponse 处理
        if (handleApiGuestResponse(response)) {

          return -1; // 使用 -1 作为特殊标记，表示需要重新登录
        }
        return 0;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('💰 [LiveWallet] Fetch failed:', response.status, errorText);
        return 0; // 发生错误时返回 0，避免 SWR 停止重试
      }

      // 解析响应数据
      const result = await response.json();

      // 检测 isGuest: true
      if (handleApiGuestResponse(response, result)) {

        return -1; // 使用 -1 作为特殊标记，表示需要重新登录
      }
      
      // 🔥 关键修复：从 /api/user/assets 获取 totalBalance（总资产）
      // 这与 WalletPage 主页面使用相同的数据源，确保数据一致
      const totalBalance = result?.success && result?.data?.totalBalance 
        ? result.data.totalBalance 
        : 0;

      return totalBalance;
    } catch (error) {
      console.error('💰 [LiveWallet] Fetcher error:', error);
      // 发生错误时返回 0，而不是抛出异常，避免 SWR 停止重试
      return 0;
    }
  };

  // 🔥 关键修复：使用 /api/user/assets 获取总资产，与主页面数据源一致
  // 🔥 只有在 shouldFetch 为 true 时才发送请求（未登录时不发送请求）
  const { data: totalBalance, isLoading, error } = useSWR<number>(
    shouldFetch ? '/api/user/assets' : null,  // 🔥 未登录时传入 null，SWR 不会发送请求
    fetcher,
    {
      refreshInterval: shouldFetch ? 5000 : 0, // 5秒刷新一次（资产数据不需要太频繁）
      revalidateOnFocus: shouldFetch, // 聚焦时刷新
      dedupingInterval: 2000, // 2秒内去重，避免重复请求
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      keepPreviousData: false, // 🔥 修复：登出后不保留之前的数据
    }
  );

  // 调试日志

  // 🔥 状态硬隔离：未认证时，必须销毁所有 DOM 节点，不显示任何内容
  // 严禁显示 $0.00 占位符，避免状态泄露
  
  // 🔥 认证状态加载中：不显示任何内容
  if (status === 'loading' || authLoading) {
    return null;
  }
  
  // 🔥 未认证：返回 null，完全销毁组件 DOM
  if (status === 'unauthenticated' || !isAuthenticated) {
    return null;
  }
  
  // 🔥 双重检查：即使 NextAuth 认证，也要检查 isLoggedIn
  if (!isLoggedIn) {
    return null;
  }

  // 🔥 架构修复：只有当 isLoggedIn 且 totalBalance 不为 undefined 时才渲染数值
  if (totalBalance === undefined || isLoading) {
    // 数据加载中：显示 Loading
    return (
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className} animate-pulse`}>
        <span className="opacity-50">...</span>
      </span>
    );
  }

  // 🔥 修复：如果 totalBalance 为 -1，表示需要重新登录，显示提示而不是余额
  if (totalBalance === -1) {
    return (
      <span className={`text-xs font-medium text-yellow-400 leading-none ${className}`}>
        需要重新登录
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

  return (
    <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className}`}>
      {formattedBalance}
    </span>
  );
}
