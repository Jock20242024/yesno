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
 * 
 * 🔥 新增：Tooltip 拆解显示资产明细
 */

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useAssets, AssetsData } from '@/hooks/useAssets';

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
  
  // 🔥 新增：使用统一的 useAssets Hook 获取完整资产数据
  const { assets, isLoading: assetsLoading } = useAssets();

  // 🔥 新增：Tooltip 显示状态
  const [showTooltip, setShowTooltip] = useState(false);

  // 🔥 核心逻辑：必须 status === 'authenticated' 才渲染组件
  // 未认证时，必须销毁所有 DOM 节点，不显示任何内容
  const isAuthenticated = status === 'authenticated';
  
  // 🔥 架构修复：不要在 authLoading 为 true 时就去解析余额
  // 只有当 NextAuth 认证且 isLoggedIn 为 true 时才发起请求
  const shouldFetch = isAuthenticated && isLoggedIn && !authLoading;

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

  // 🔥 增加加载保护：在 assets 数据为 undefined 时，显示 --- 或加载动画，而不是错误的 $0.00
  if (assets === undefined || assetsLoading) {
    // 数据加载中：显示 --- 而不是 $0.00
    return (
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className} animate-pulse`}>
        <span className="opacity-50">---</span>
      </span>
    );
  }

  // 🔥 架构修复：只有当 isLoggedIn 且 assets 不为 undefined 时才渲染数值
  // totalBalance 可以是 0，但不能是 undefined
  // 🔥 强化数据安全性：确保 totalBalance 是有效数字，防止 NaN
  const rawTotalBalance = assets.totalBalance || 0;
  const displayBalance = Number(rawTotalBalance);
  const safeDisplayBalance = (isNaN(displayBalance) || !isFinite(displayBalance)) ? 0 : displayBalance;
  
  // 🔥 统一取值逻辑：使用 Number 和 toLocaleString 确保格式一致
  // 格式化余额显示
  const formattedBalance = Number(safeDisplayBalance).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  // 格式化拆解数据
  const formatCurrency = (amount: number) => {
    const safeAmount = Number(amount || 0);
    const finalAmount = (isNaN(safeAmount) || !isFinite(safeAmount)) ? 0 : safeAmount;
    return Number(finalAmount).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // 显示状态：格式化后的余额（强制显示，即使是 0 也要显示）
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
              {formatCurrency(Number(assets.availableBalance || 0))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🔵 持仓价值</span>
            <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
              {formatCurrency(Number(assets.positionsValue || 0))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🔴 冻结资金</span>
            <span className="text-xs font-bold text-zinc-300 font-mono tabular-nums">
              {formatCurrency(Number(assets.frozenBalance || 0))}
            </span>
          </div>
          
          <div className="border-t border-white/10 pt-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">总资产</span>
              <span className="text-xs font-black text-white font-mono tabular-nums">
                {formatCurrency(Number(assets.totalBalance || 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
