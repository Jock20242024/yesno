"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { MARKET_DATA } from "@/lib/data";
import { CATEGORY_MAP } from "@/lib/categories";
import { CATEGORY_FILTERS_CONFIG } from "@/lib/constants/categoryFilters";
import { Market } from "@/types/api";
import { MarketEvent } from "@/lib/data";
import FilterSidebar from "@/components/category/FilterSidebar";
import MarketCard from "@/components/MarketCard";
import { Loader2 } from "lucide-react";

interface CategoryPageProps {
  params: {
    slug: string;
  };
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

export default function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = params;
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [marketData, setMarketData] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 检查该分类是否有筛选配置
  const hasFilters = !!CATEGORY_FILTERS_CONFIG[slug];

  let categoryName: string;
  let pageTitle: string;

  // 确定分类名称
  if (slug === "all") {
    categoryName = "所有市场";
    pageTitle = "所有市场";
  } else if (slug === "trending") {
    categoryName = "热门";
    pageTitle = "热门趋势";
  } else {
    if (!CATEGORY_MAP[slug]) {
      notFound();
    }
    categoryName = CATEGORY_MAP[slug];
    pageTitle = categoryName;
  }

  // 获取市场数据
  const fetchMarkets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (slug !== "all" && slug !== "trending") {
        params.append("category", slug);
      }

      const response = await fetch(`/api/markets?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch markets");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        let markets = result.data;
        
        // 如果是热门，按交易量排序并取前 10
        if (slug === "trending") {
          markets = [...markets]
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 10);
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

  // 组件加载时获取数据
  useEffect(() => {
    fetchMarkets();
  }, [slug]);

  // 将 Market 类型转换为 MarketEvent 类型（用于兼容 MarketCard）
  // 注意：我们需要保存原始的市场 ID（UUID），因为 MarketEvent.id 是 number 类型
  const convertMarketToEvent = (market: Market): MarketEvent & { originalId?: string } => {
    // 安全日期格式化：检查日期字段是否存在且有效
    // 支持 endTime（API 类型）和 closingDate（数据库类型）两种字段名
    const getSafeDeadline = (dateValue?: string | Date): string => {
      if (!dateValue) return "N/A";
      
      try {
        const date = new Date(dateValue);
        // 检查日期是否有效
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

    // 尝试从 endTime 或 closingDate 字段获取日期（兼容不同的数据结构）
    const dateValue = (market as any).endTime || (market as any).closingDate;

    // 注意：MarketEvent.id 是 number 类型，但数据库中的 market.id 是 UUID 字符串
    // 为了保持兼容性，我们使用一个简单的数字 ID（基于 UUID 的哈希或使用索引）
    // 但在实际导航时，应该使用原始的 market.id（UUID）
    // 这里我们使用一个临时方案：将 UUID 转换为数字（仅用于显示，实际路由使用原始 ID）
    let numericId: number;
    try {
      // 尝试将 UUID 的第一部分转换为数字（仅用于兼容 MarketEvent 接口）
      // 实际的路由应该使用原始的 market.id
      const uuidParts = market.id.split('-');
      numericId = parseInt(uuidParts[0], 16) || 1; // 使用 UUID 第一部分的十六进制值
    } catch {
      numericId = 1; // 默认值
    }

    return {
      id: numericId, // 临时数字 ID（用于兼容 MarketEvent 接口）
      rank: 1, // 分类页面不需要排名
      title: market.title,
      category: market.category || '未分类',
      categorySlug: market.categorySlug || 'all',
      icon: "Bitcoin", // 可以根据 category 映射
      iconColor: "bg-[#f7931a]",
      yesPercent: market.yesPercent || 50,
      noPercent: market.noPercent || 50,
      deadline: getSafeDeadline(dateValue),
      imageUrl: market.imageUrl || '',
      volume: formatVolume(market.volume),
      comments: market.commentsCount || 0,
      originalId: market.id, // 保存原始的市场 ID（UUID），用于导航
    };
  };

  // 格式化交易量
  const formatVolume = (volume: number | undefined | null): string => {
    // 安全检查：处理 undefined、null 或无效值
    if (volume === undefined || volume === null || isNaN(volume)) {
      return "$0.00"; // 返回安全的默认值
    }

    // 确保 volume 是数字类型
    const volumeNum = Number(volume);
    if (isNaN(volumeNum) || volumeNum < 0) {
      return "$0.00";
    }

    // 格式化逻辑
    if (volumeNum >= 1000000) {
      return `$${(volumeNum / 1000000).toFixed(1)}m`;
    } else if (volumeNum >= 1000) {
      return `$${(volumeNum / 1000).toFixed(1)}k`;
    }
    return `$${volumeNum.toLocaleString()}`;
  };

  const filteredEvents = marketData.map(convertMarketToEvent);

  return (
    <>
      <div className="flex-1 w-full lg:max-w-[1600px] lg:mx-auto">
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Page Title */}
          <div className="px-4 md:px-6 py-6 border-b border-border-dark">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {pageTitle}
            </h1>
          </div>

          {/* Content Area with Sidebar */}
          <div className="flex gap-6 px-4 md:px-6 py-6">
            {/* Left Sidebar - Filter */}
            {hasFilters && (
              <FilterSidebar
                slug={slug}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />
            )}

            {/* Right Content - Market Cards Grid */}
            <div className="flex-1 flex flex-col gap-6">
              {/* 加载状态 */}
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-text-secondary">Loading Markets...</span>
                </div>
              )}

              {/* 错误状态 */}
              {error && !isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <p className="text-red-500 font-medium mb-2">Error fetching data.</p>
                    <p className="text-text-secondary text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* 数据展示 */}
              {!isLoading && !error && (
                <>
                  {filteredEvents.length > 0 ? (
                    <div className="grid grid-cols-4 gap-6">
                      {filteredEvents.map((event) => (
                        <MarketCard key={event.id} event={event} />
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

