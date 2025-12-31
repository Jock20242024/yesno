"use client";

import { useState, useEffect } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { MarketEvent } from "@/lib/data";
import dayjs from "@/lib/dayjs"; // 🔥 使用全局初始化的 dayjs
import {
  Bitcoin,
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
  LucideIcon,
} from "lucide-react";
import { EthereumIcon } from "@/components/icons/EthereumIcon";

// 🔥 扩展 iconMap 类型以支持自定义组件
type IconComponent = LucideIcon | React.ComponentType<{ className?: string }>;

const iconMap: Record<string, IconComponent> = {
  Bitcoin,
  Ethereum: EthereumIcon, // 🔥 使用自定义以太坊图标
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
};

export type MarketStatus = "open" | "closed";
export type MarketResult = "YES_WON" | "NO_WON" | null;

interface MarketHeaderProps {
  event: MarketEvent;
  status?: MarketStatus;
  result?: MarketResult;
  closingDate?: string; // ISO 8601 格式的关闭时间
  period?: number | null; // 🔥 周期（分钟数），用于计算时间区间
  isFactory?: boolean; // 🔥 是否为工厂市场
}

// 倒计时计算函数
function calculateCountdown(closingDate: string): { days: number; hours: number; minutes: number; seconds: number; isExpired: boolean } {
  const now = new Date().getTime();
  const closing = new Date(closingDate).getTime();
  const diff = closing - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isExpired: false };
}

export default function MarketHeader({ event, status = "open", result = null, closingDate, period, isFactory }: MarketHeaderProps) {
  // 🔥 逻辑守卫：确保 event 存在
  if (!event || !event.id) {
    return (
      <div className="text-center py-4 text-gray-400">加载中...</div>
    );
  }

  // 🔥 修复：从 event 中提取 icon 和 iconColor，如果没有则根据 symbol/title 动态计算
  const getIconAndColor = () => {
    // 优先使用 API 返回的 icon 和 iconColor
    if ((event as any).icon && (event as any).iconColor) {
      return {
        icon: (event as any).icon,
        iconColor: (event as any).iconColor,
      };
    }
    
    // 如果没有，根据 symbol/title 动态判断
    const symbol = (event as any).symbol || '';
    const title = event.title || '';
    const symbolUpper = symbol.toUpperCase();
    const titleUpper = title.toUpperCase();
    
    if (symbolUpper.includes('ETH') || titleUpper.includes('ETH') || titleUpper.includes('以太坊') || titleUpper.includes('ETHEREUM')) {
      return {
        icon: 'Ethereum',
        iconColor: 'bg-[#627EEA]', // 以太坊蓝色
      };
    }
    if (symbolUpper.includes('BTC') || titleUpper.includes('BTC') || titleUpper.includes('比特币') || titleUpper.includes('BITCOIN')) {
      return {
        icon: 'Bitcoin',
        iconColor: 'bg-[#f7931a]', // 比特币橙色
      };
    }
    
    // 默认使用 Bitcoin
    return {
      icon: event.icon || 'Bitcoin',
      iconColor: (event as any).iconColor || 'bg-[#f7931a]',
    };
  };

  const { icon, iconColor } = getIconAndColor();
  const IconComponent = iconMap[icon] || Bitcoin;
  
  // 🔥 修复状态判断：对于工厂市场，如果 closingDate 已过期，即使状态还是 OPEN，也应该视为"已结束"
  const isExpired = closingDate ? new Date(closingDate).getTime() <= Date.now() : false;
  const isResolved = (status === "closed" || (isFactory && isExpired)) && result !== null;
  const isYesWon = result === "YES_WON";
  // 🔥 工厂市场：即使状态是 OPEN，如果时间已过期，也显示为已结束
  const displayStatus = isFactory && isExpired && status === "open" ? "closed" : status;
  
  // 倒计时状态
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean } | null>(null);
  
  // 🔥 计算时间区间：StartTime = EndTime - 周期时间（参考 Polymarket 风格）
  // 🔥 动态使用用户本地时区，确保与导航按钮时间完全对齐
  const getTimeInterval = (): string | null => {
    if (!closingDate || !isFactory || !period) return null;
    
    try {
      // 🔥 动态获取用户时区（仅用于时间转换，不显示）
      const userTimeZone = typeof window !== 'undefined' 
        ? Intl.DateTimeFormat().resolvedOptions().timeZone 
        : 'Asia/Shanghai';
      
      // 后端返回的 closingDate 视为 UTC，转换为用户本地时区
      const endTime = dayjs(closingDate).tz(userTimeZone);
      const startTime = endTime.subtract(period, 'minute'); // 减去周期（分钟）
      
      // 🔥 使用 dayjs 格式化用户本地时区
      const dateStr = startTime.format('M月D日');
      const startTimeStr = startTime.format('HH:mm');
      const endTimeStr = endTime.format('HH:mm');
      
      // 🔥 规范化格式：删除地理位置字符串，只显示简洁的时间格式
      return `${dateStr}，当地时间 ${startTimeStr}–${endTimeStr}`;
    } catch (error) {
      console.error('计算时间区间失败:', error);
      return null;
    }
  };
  
  const timeInterval = getTimeInterval();
  
  // 计算倒计时
  useEffect(() => {
    // 🔥 修复：对于工厂市场，如果已过期但状态还是 open，也停止倒计时
    if (!closingDate || isResolved || (isFactory && isExpired)) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const result = calculateCountdown(closingDate);
      setCountdown(result);
      // 🔥 如果倒计时过期，停止更新
      if (result.isExpired) {
        setCountdown(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [closingDate, isResolved, isFactory, isExpired]);

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* 市场已结束 Banner */}
      {isResolved && (
        <div
          className={`w-full px-6 py-4 rounded-xl border-2 shadow-lg ${
            isYesWon
              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/50 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
              isYesWon ? "bg-emerald-500" : "bg-rose-500"
            } animate-pulse`} />
            <div className="flex-1">
              <p className="text-sm font-bold">
                市场已结束：{isYesWon ? "YES" : "NO"} 获胜
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Market Resolved: {isYesWon ? "YES" : "NO"} Won
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
      <div className="size-16 rounded-xl bg-white/5 p-1.5 flex-shrink-0 border border-pm-border">
        <div
          className={`w-full h-full rounded-lg ${iconColor} flex items-center justify-center text-white shadow-inner`}
        >
          <IconComponent className="w-10 h-10" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-[32px] font-bold text-white leading-tight mb-2">
          {event.title}
        </h1>
        {/* 🔥 时间区间显示（参考 Polymarket 风格） */}
        {timeInterval && (
          <div className="mb-3 text-sm text-pm-text-dim font-medium">
            {timeInterval}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-xs font-medium text-pm-text-dim">
          {/* 🔥 如果市场已结束（包括工厂市场时间过期），显示"已结束"标签 */}
          {isResolved || (isFactory && isExpired) ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
              <Clock className="w-[18px] h-[18px] text-pm-text-dim" />
              <span className="font-bold text-sm text-pm-text-dim">已结束</span>
            </div>
          ) : countdown && !countdown.isExpired ? (
            /* 如果市场未结束且有倒计时，显示倒计时 */
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
              <Clock className="w-[18px] h-[18px] text-pm-blue animate-pulse" />
              <div className="flex items-baseline gap-1">
                <span className="font-mono font-bold tracking-wide text-sm">
                  {String(countdown.days).padStart(2, '0')}<span className="text-[10px] text-pm-text-dim font-sans ml-0.5 mr-1">
                    天
                  </span>
                  {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          ) : (
            /* 如果倒计时已过期但状态还是 open，显示"已结束" */
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
              <Clock className="w-[18px] h-[18px] text-pm-text-dim" />
              <span className="font-bold text-sm text-pm-text-dim">已结束</span>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

