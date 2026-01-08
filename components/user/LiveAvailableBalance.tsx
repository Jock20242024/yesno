"use client";

/**
 * LiveAvailableBalance - 实时可用余额显示组件
 * 
 * 🔥 关键修复：与交易区使用相同的数据源
 * - 使用 /api/user/assets 的 availableBalance
 * - 与交易区显示一致，确保数据同步
 * 
 * 🔥 新增：Tooltip 拆解显示资产明细
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useAssets } from '@/hooks/useAssets';
import { useLanguage } from '@/i18n/LanguageContext';

interface LiveAvailableBalanceProps {
  className?: string;
}

export default function LiveAvailableBalance({ className = "" }: LiveAvailableBalanceProps) {
  // 🔥 核心修复：使用统一的 useAssets Hook 获取完整资产数据
  // 确保顶栏显示的"可用"金额与 Tooltip 内部的"可用余额"使用完全相同的变量
  const { assets, isLoading: assetsLoading } = useAssets();
  const { t, language } = useLanguage(); // 🔥 修复：添加语言切换支持，同时获取 language 确保响应式更新
  
  // 🔥 新增：Tooltip 显示状态
  const [showTooltip, setShowTooltip] = useState(false);
  
  const sessionQuery = useSession();
  const session = sessionQuery?.data ?? null;
  const status = sessionQuery?.status ?? 'unauthenticated';
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  const isAuthenticated = status === 'authenticated';

  // 🔥 认证状态检查
  if (status === 'loading' || authLoading) {
    return null;
  }
  
  if (status === 'unauthenticated' || !isAuthenticated || !isLoggedIn) {
    return null;
  }

  // 🔥 增加加载保护：在 assets 数据为 undefined 时，显示 --- 而不是错误的 $0.00
  if (assets === undefined || assetsLoading) {
    return (
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight tabular-nums ${className} animate-pulse`}>
        <span className="opacity-50">---</span>
      </span>
    );
  }

  // 🔥 统一取值逻辑：使用 assets.availableBalance（与 Tooltip 内部完全相同的变量）
  // 强化数据安全性：确保 availableBalance 是有效数字，防止 NaN
  const rawAvailableBalance = assets.availableBalance || 0;
  const availableBalance = Number(rawAvailableBalance);
  const safeBalance = (isNaN(availableBalance) || !isFinite(availableBalance)) ? 0 : availableBalance;

  // 🔥 格式化余额显示：使用 Number 和 toLocaleString 确保格式一致
  const formattedBalance = Number(safeBalance).toLocaleString('en-US', {
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

  // 🔥 新增：添加 Tooltip 显示资产拆解
  // 🔥 统一取值逻辑：确保 Tooltip 内部的"可用余额"使用与顶栏完全相同的变量
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
      {/* 🔥 修复：添加 key={language} 确保语言切换时强制重新渲染 */}
      {showTooltip && assets && (
        <div key={language} className="absolute right-0 top-full mt-2 w-56 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
            {t('portfolio.stats.asset_breakdown')}
          </div>
          
          {/* 🔥 统一取值逻辑：使用与顶栏完全相同的变量 assets.availableBalance */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🟢 {t('portfolio.stats.available_balance')}</span>
            <span className="text-xs font-bold text-white font-mono tabular-nums">
              {formatCurrency(Number(assets.availableBalance || 0))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🔵 {t('portfolio.stats.holding_value')}</span>
            <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
              {formatCurrency(Number(assets.positionsValue || 0))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">🔴 {t('portfolio.stats.frozen_funds')}</span>
            <span className="text-xs font-bold text-zinc-300 font-mono tabular-nums">
              {formatCurrency(Number(assets.frozenBalance || 0))}
            </span>
          </div>
          
          <div className="border-t border-white/10 pt-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400">{t('portfolio.stats.total_assets')}</span>
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

