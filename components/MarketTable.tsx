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
  Loader2,
} from "lucide-react";
import { MarketEvent } from "@/lib/data";
import { Market } from "@/types/api";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

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
  data?: MarketEvent[]; // 可选，如果提供则使用静态数据，否则从 API 获取
}

// 将 volume 字符串转换为数字用于排序
function parseVolume(volume?: string): number {
  if (!volume) return 0;
  
  // 🔥 修复：确保在调用 replace 之前先转换为字符串
  const cleaned = String(volume || '').replace(/[$,\s]/g, "").toLowerCase();
  
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

export default function MarketTable({ data: staticData }: MarketTableProps) {
  const [marketData, setMarketData] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(!staticData);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 获取市场数据
  const fetchMarkets = async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // 🔥 强制实时刷新：禁用缓存，使用 pageSize=100 确保有足够数据
      const response = await fetch(`/api/markets?page=${pageNum}&pageSize=100`, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch markets');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        if (append) {
          setMarketData(prev => [...prev, ...result.data]);
        } else {
          setMarketData(result.data);
        }
        // 🔥 设置 hasMore 状态
        setHasMore(result.pagination?.hasMore || false);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data.');
      console.error('Error fetching markets:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // 加载更多
  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMarkets(nextPage, true);
    }
  };

  // 如果提供了静态数据，使用静态数据；否则从 API 获取
  useEffect(() => {
    if (!staticData) {
      fetchMarkets(1, false);
    }
  }, [staticData]);

  // 将 Market 类型转换为 MarketEvent 类型（用于兼容现有 UI）
  const convertMarketToEvent = (market: Market, rank: number): MarketEvent => {
    // 🔥 优先使用 displayVolume，如果没有则使用 volume 或 totalVolume（向后兼容）
    const displayVolume = market.displayVolume ?? market.volume ?? market.totalVolume ?? 0;
    
    // 🚀 第一优先级：解析 outcomePrices（数据库真实数据）
    let yesPercent: number = market.yesPercent || 50;
    let noPercent: number = market.noPercent || 50;
    
    try {
      const outcomePrices = (market as any).outcomePrices;
      if (outcomePrices) {
        const prices = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
        if (Array.isArray(prices) && prices.length > 0 && prices[0]) {
          const yesPrice = parseFloat(prices[0]);
          if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
            yesPercent = Math.round(yesPrice * 100);
            noPercent = 100 - yesPercent;
          }
        }
      }
    } catch (e) {
      // JSON 解析失败，继续使用默认值
    }
    
    // 🚀 第二优先级：使用 initialPrice（数据库真实数据）
    if (yesPercent === 50 && noPercent === 50) {
      const initialPrice = (market as any).initialPrice;
      if (typeof initialPrice === 'number' && !isNaN(initialPrice) && initialPrice >= 0 && initialPrice <= 1) {
        yesPercent = Math.round(initialPrice * 100);
        noPercent = 100 - yesPercent;
      }
    }
    
    // 🔥 优先使用 image，然后 imageUrl，最后 iconUrl
    const imageUrl = (market as any).image || market.imageUrl || (market as any).iconUrl || '';
    
    return {
      id: parseInt(market.id),
      rank,
      title: market.title,
      category: market.category,
      categorySlug: market.categorySlug,
      icon: 'Bitcoin', // 默认图标，可以根据 category 映射
      iconColor: 'bg-[#f7931a]', // 默认颜色
      yesPercent,
      noPercent,
      deadline: new Date(market.endTime).toISOString().split('T')[0],
      imageUrl,
      // 🔥 添加原始数据字段（传递给 MarketCard 使用）
      outcomePrices: (market as any).outcomePrices || null,
      image: (market as any).image || null,
      iconUrl: (market as any).iconUrl || null,
      initialPrice: (market as any).initialPrice || null,
      volume24h: (market as any).volume24h || null,
      totalVolume: (market as any).totalVolume || null,
      externalVolume: (market as any).externalVolume || null,
      originalId: market.id,
      volume: formatVolume((market as any).volume24h || displayVolume),
      comments: market.commentsCount,
    };
  };

  // 格式化交易量（使用 formatCurrency 工具函数）
  const formatVolume = (volume: number | string | null | undefined): string => {
    // 🔥 使用 formatCurrency 工具函数，安全处理字符串和数字
    return formatCurrency(volume, { compact: true, decimals: 1 });
  };

  // 确定使用的数据源
  const dataToUse = staticData || marketData.map((market, index) => convertMarketToEvent(market, index + 1));

  // 按交易量从高到低排序
  const sortedData = useMemo(() => {
    return [...dataToUse].sort((a, b) => {
      const volumeA = parseVolume(a.volume);
      const volumeB = parseVolume(b.volume);
      return volumeB - volumeA; // 从高到低
    });
  }, [dataToUse]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-surface-dark rounded-lg border border-border-dark text-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <h2 className="text-white text-xl font-bold">Top 10 Trending Markets</h2>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-text-secondary">Loading markets...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-500 font-medium mb-2">Error fetching data.</p>
            <p className="text-text-secondary text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 桌面端表格 */}
      {!isLoading && !error && (
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
      )}

      {/* 加载更多按钮 */}
      {!isLoading && !error && !staticData && hasMore && (
        <div className="flex justify-center py-6">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-3 bg-pm-card border border-pm-border rounded-xl text-white font-medium hover:bg-pm-card-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                加载中...
              </>
            ) : (
              '加载更多'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

