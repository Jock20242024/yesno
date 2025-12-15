"use client";

import {
  Trophy,
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
import { MarketEvent } from "@/lib/data";
import Link from "next/link";
import { useMemo } from "react";

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

interface MarketTableProps {
  data: MarketEvent[];
}

// 将 volume 字符串转换为数字用于排序
function parseVolume(volume?: string): number {
  if (!volume) return 0;
  
  // 移除 $ 符号和空格
  const cleaned = volume.replace(/[$,\s]/g, "").toLowerCase();
  
  // 提取数字和单位
  const match = cleaned.match(/^([\d.]+)([km]?)$/);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const unit = match[2];
  
  // 转换为统一单位（美元）
  if (unit === "k") return num * 1000;
  if (unit === "m") return num * 1000000;
  return num;
}

export default function MarketTable({ data }: MarketTableProps) {
  // 按交易量从高到低排序
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const volumeA = parseVolume(a.volume);
      const volumeB = parseVolume(b.volume);
      return volumeB - volumeA; // 从高到低
    });
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-surface-dark rounded-lg border border-border-dark text-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <h2 className="text-white text-xl font-bold">全网热门事件 Top 10</h2>
        </div>
      </div>
      {/* 桌面端表格 */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border-dark bg-surface-dark/50 backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-dark border-b border-border-dark">
                <th className="px-4 py-4 text-text-secondary text-xs font-medium uppercase tracking-wider w-16 text-center">
                  排名
                </th>
                <th className="px-4 py-4 text-text-secondary text-xs font-medium uppercase tracking-wider min-w-[280px]">
                  事件
                </th>
                <th className="px-4 py-4 text-text-secondary text-xs font-medium uppercase tracking-wider min-w-[280px]">
                  预测概率 (Yes/No)
                </th>
                <th className="px-4 py-4 text-text-secondary text-xs font-medium uppercase tracking-wider w-32 hidden sm:table-cell">
                  截止日期
                </th>
                <th className="px-4 py-4 text-text-secondary text-xs font-medium uppercase tracking-wider w-24 text-right">
                  交易量
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark text-sm">
              {sortedData.map((event) => {
                const IconComponent = iconMap[event.icon] || Bitcoin;
                const isTopThree = event.rank <= 3;
                return (
                  <tr
                    key={event.id}
                    className="group hover:bg-surface-dark transition-colors"
                  >
                    <td className="px-4 py-4 text-center">
                      {isTopThree ? (
                        <div
                          className={`flex items-center justify-center size-8 mx-auto rounded-full ${
                            event.rank === 1
                              ? "bg-primary/20 text-primary"
                              : "bg-gray-600/30 text-white"
                          } font-bold`}
                        >
                          {event.rank}
                        </div>
                      ) : (
                        <span className="text-text-secondary font-medium">
                          {event.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/markets/${event.id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div
                          className={`size-8 rounded-full ${event.iconColor} flex items-center justify-center shrink-0`}
                        >
                          <IconComponent className="text-white w-[18px] h-[18px]" />
                        </div>
                        <span className="font-bold text-white group-hover:text-primary transition-colors cursor-pointer line-clamp-2">
                          {event.title}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[#10B981]">
                            Yes {event.yesPercent}%
                          </span>
                          <span className="text-[#EF4444]">
                            No {event.noPercent}%
                          </span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-dark border border-white/5">
                          <div
                            className="bg-[#10B981] h-full"
                            style={{ width: `${event.yesPercent}%` }}
                          />
                          <div
                            className="bg-[#EF4444] h-full"
                            style={{ width: `${event.noPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-text-secondary hidden sm:table-cell">
                      {event.deadline}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-mono font-bold text-blue-400 tabular-nums">
                        {event.volume || "$0"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

