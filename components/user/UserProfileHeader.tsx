"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

interface UserProfileHeaderProps {
  userId: string;
  userName: string;
  profit: number;
  positionsValue: string;
  biggestWin: string;
  predictions: number;
  joinDate: string;
}

export default function UserProfileHeader({
  userId,
  userName,
  profit,
  positionsValue,
  biggestWin,
  predictions,
  joinDate,
}: UserProfileHeaderProps) {
  const { t, language } = useLanguage();
  const [activeTimeTab, setActiveTimeTab] = useState("ALL");
  
  // 使用 useMemo 确保翻译一致性，避免 Hydration 错误
  const timeTabs = useMemo(() => [
    { id: "1D", label: "1D" },
    { id: "1W", label: "1W" },
    { id: "1M", label: t('common.time.1M') },
    { id: "ALL", label: t('common.time.all') },
  ], [t]);

  const formatProfit = (amount: number) => {
    const sign = amount >= 0 ? "+" : "";
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 主信息区域 - 两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：用户信息 */}
        <div className="flex flex-col gap-6">
          {/* 用户头像和基本信息 */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#D4AF37] flex-shrink-0 bg-pm-card" style={{ boxShadow: '0 0 8px rgba(212, 175, 55, 0.3)' }}>
                <img
                  src="/logo.svg"
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-white">{userName}</h1>
              <button className="w-fit px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium text-white transition-colors">
                {language === 'en' ? 'Connect X' : '连接 X'}
              </button>
            </div>
          </div>

          {/* 注册日期 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{language === 'en' ? 'Joined' : '加入时间'}</span>
            <span className="text-sm text-zinc-300">{joinDate}</span>
          </div>

          {/* 数据统计 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">
                {t('profile.stats.portfolio_value')}
              </span>
              <span className="text-lg font-bold text-white">{positionsValue}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">
                {t('profile.stats.max_win')}
              </span>
              <span className="text-lg font-bold text-pm-green">{biggestWin}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">
                {t('profile.stats.predictions_count')}
              </span>
              <span className="text-lg font-bold text-white">{predictions}</span>
            </div>
          </div>
        </div>

        {/* 右侧：利润/亏损卡片 */}
        <div className="flex flex-col gap-4">
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400 uppercase tracking-wider">
                  {t('profile.stats.pnl')}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-4xl font-black ${
                    profit >= 0 ? "text-pm-green" : "text-pm-red"
                  }`}
                >
                  {formatProfit(profit)}
                </span>
              </div>
            </div>
          </div>

          {/* 时间筛选 Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800">
            {timeTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTimeTab(tab.id)}
                className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${
                  activeTimeTab === tab.id
                    ? "text-white border-pm-green"
                    : "text-zinc-400 border-transparent hover:text-white"
                }`}
              >
                <span suppressHydrationWarning>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

