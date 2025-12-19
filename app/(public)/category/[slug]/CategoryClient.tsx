'use client';

import { useState, useEffect } from "react";
import { Market } from "@/types/api";
import { MarketEvent } from "@/lib/data";
import MarketCard from "@/components/MarketCard";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import SubCategoryTabs from "./SubCategoryTabs";

interface CategoryClientProps {
  slug: string;
  categoryName: string;
  pageTitle: string;
  hasFilters: boolean;
}

// 将 volume 字符串转换为数字用于排序
function parseVolume(volume?: string): number {
  if (!volume) return 0;
  
  const cleaned = volume.replace(/[$,\s]/g, "").toLowerCase();
  const match = cleaned.match(/^([\d.]+)([km]?)$/);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const unit = match[2];
  
  if (unit === "k") return num * 1000;
  if (unit === "m") return num * 1000000;
  return num;
}

export default function CategoryClient({ slug, categoryName, pageTitle, hasFilters }: CategoryClientProps) {
  // 架构加固：Page/ClientPage 级别读取 Context，通过 props 传给子组件
  const { isLoggedIn } = useAuth();
  
  // activeFilter 用于子分类筛选："all" 表示显示全部，其他值表示子分类 slug
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [marketData, setMarketData] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取市场数据
  const fetchMarkets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      // 如果 activeFilter 是 "all"，显示当前分类的所有市场
      // 否则，根据 activeFilter（子分类 slug）筛选
      if (slug === "all") {
        // "所有市场" 页面，不添加 category 参数
      } else if (slug === "hot" || slug === "trending") {
        params.append("category", "hot");
      } else {
        // 普通分类页面
        if (activeFilter !== "all" && activeFilter !== slug) {
          // 如果选择了子分类，使用子分类的 slug
          params.append("category", activeFilter);
        } else {
          // 如果选择"全部"，使用当前分类的 slug
          params.append("category", slug);
        }
      }

      const response = await fetch(`/api/markets?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch markets");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        let markets = result.data;
        
        if (slug === "hot" || slug === "trending") {
          // 热门市场已经由后端按 isHot 筛选和排序，这里不需要再次处理
          // 但如果是 trending（旧逻辑），可能需要限制数量
          if (slug === "trending") {
            markets = markets.slice(0, 20);
          }
        }
        
        setMarketData(markets);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching data.");
      console.error("Error fetching markets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, [slug, activeFilter]);

  // 将 Market 类型转换为 MarketEvent 类型
  const convertMarketToEvent = (market: Market): MarketEvent & { originalId?: string } => {
    const getSafeDeadline = (dateValue?: string | Date): string => {
      if (!dateValue) return "N/A";
      
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          console.warn('Invalid date value:', dateValue);
          return "N/A";
        }
        return date.toISOString().split("T")[0];
      } catch (error) {
        console.error('Error parsing date:', dateValue, error);
        return "N/A";
      }
    };

    const dateValue = (market as any).endTime || (market as any).closingDate;

    let numericId: number;
    try {
      const uuidParts = market.id.split('-');
      numericId = parseInt(uuidParts[0], 16) || 1;
    } catch {
      numericId = 1;
    }

    return {
      id: numericId,
      rank: 1,
      title: market.title,
      category: market.category || '未分类',
      categorySlug: market.categorySlug || 'all',
      icon: "Bitcoin",
      iconColor: "bg-[#f7931a]",
      yesPercent: market.yesPercent || 50,
      noPercent: market.noPercent || 50,
      deadline: getSafeDeadline(dateValue),
      imageUrl: market.imageUrl || '',
      volume: formatVolume(market.volume),
      comments: market.commentsCount || 0,
      originalId: market.id,
    };
  };

  // 格式化交易量
  const formatVolume = (volume: number | undefined | null): string => {
    if (volume === undefined || volume === null || isNaN(volume)) {
      return "$0.00";
    }

    const volumeNum = Number(volume);
    if (isNaN(volumeNum) || volumeNum < 0) {
      return "$0.00";
    }

    if (volumeNum >= 1000000) {
      return `$${(volumeNum / 1000000).toFixed(1)}m`;
    } else if (volumeNum >= 1000) {
      return `$${(volumeNum / 1000).toFixed(1)}k`;
    }
    return `$${volumeNum.toLocaleString()}`;
  };

  const filteredEvents = marketData.map(convertMarketToEvent);

  // STEP 3: 逐个恢复 UI 组件 - 测试 1: 基础布局
  return (
    <>
      <div className="flex-1 w-full lg:max-w-[1600px] lg:mx-auto">
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="px-4 md:px-6 py-6 border-b border-border-dark">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {pageTitle}
            </h1>
            {/* 子分类标签栏 - 显示当前分类的子分类 */}
            <SubCategoryTabs slug={slug} onFilterChange={setActiveFilter} activeFilter={activeFilter} />
          </div>

          <div className="px-4 md:px-6 py-6">
            {/* 主体内容区域 - 已移除左侧侧边栏 */}
            <div className="flex flex-col gap-6">
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-text-secondary">Loading Markets...</span>
                </div>
              )}

              {error && !isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <p className="text-red-500 font-medium mb-2">Error fetching data.</p>
                    <p className="text-text-secondary text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* 市场列表展示 */}
              {!isLoading && !error && (
                <>
                  {filteredEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredEvents.map((event) => (
                        <MarketCard key={event.id} event={event} isLoggedIn={isLoggedIn} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="text-6xl mb-4">📭</div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        暂无数据
                      </h3>
                      <p className="text-pm-text-dim text-sm">
                        {categoryName} 分类下暂时没有市场事件
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
