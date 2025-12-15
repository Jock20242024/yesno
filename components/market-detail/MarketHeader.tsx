"use client";

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
}

export default function MarketHeader({ event, status = "open", result = null }: MarketHeaderProps) {
  const IconComponent = iconMap[event.icon] || Bitcoin;
  const isResolved = status === "closed" && result !== null;
  const isYesWon = result === "YES_WON";

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
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-pm-card border border-pm-border text-white shadow-sm ring-1 ring-white/5">
            <Clock className="w-[18px] h-[18px] text-pm-blue animate-pulse" />
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-bold tracking-wide text-sm">
                04<span className="text-[10px] text-pm-text-dim font-sans ml-0.5 mr-1">
                  天
                </span>
                12:45:30
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

