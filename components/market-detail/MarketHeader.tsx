"use client";

import { useState, useEffect } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { MarketEvent } from "@/lib/data";
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

const iconMap: Record<string, LucideIcon> = {
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
};

export type MarketStatus = "open" | "closed";
export type MarketResult = "YES_WON" | "NO_WON" | null;

interface MarketHeaderProps {
  event: MarketEvent;
  status?: MarketStatus;
  result?: MarketResult;
  closingDate?: string; // ISO 8601 格式的关闭时间
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

export default function MarketHeader({ event, status = "open", result = null, closingDate }: MarketHeaderProps) {
  const IconComponent = iconMap[event.icon] || Bitcoin;
  const isResolved = status === "closed" && result !== null;
  const isYesWon = result === "YES_WON";
  
  // 倒计时状态
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean } | null>(null);
  
  // 计算倒计时
  useEffect(() => {
    if (!closingDate || isResolved) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const result = calculateCountdown(closingDate);
      setCountdown(result);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [closingDate, isResolved]);

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
          className={`w-full h-full rounded-lg ${event.iconColor} flex items-center justify-center text-white shadow-inner`}
        >
          <IconComponent className="w-10 h-10" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-[32px] font-bold text-white leading-tight mb-4">
          {event.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-xs font-medium text-pm-text-dim">
          {/* 如果市场已结束，显示"已结束"标签 */}
          {isResolved ? (
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

