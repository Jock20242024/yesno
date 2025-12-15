"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { MARKET_DATA } from "@/lib/data";
import { CATEGORY_MAP } from "@/lib/categories";
import { CATEGORY_FILTERS_CONFIG } from "@/lib/constants/categoryFilters";
import FilterSidebar from "@/components/category/FilterSidebar";
import MarketCard from "@/components/MarketCard";

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

  // 检查该分类是否有筛选配置
  const hasFilters = !!CATEGORY_FILTERS_CONFIG[slug];

  let filteredEvents;
  let categoryName: string;
  let pageTitle: string;

  // 特殊情况 A - 所有市场
  if (slug === "all") {
    filteredEvents = MARKET_DATA;
    categoryName = "所有市场";
    pageTitle = "所有市场";
  }
  // 特殊情况 B - 热门
  else if (slug === "trending") {
    // 按交易量从高到低排序，取前 10 条
    filteredEvents = [...MARKET_DATA]
      .sort((a, b) => parseVolume(b.volume) - parseVolume(a.volume))
      .slice(0, 10);
    categoryName = "热门";
    pageTitle = "热门趋势";
  }
  // 默认情况 - 按分类筛选
  else {
    // 验证 slug 是否有效
    if (!CATEGORY_MAP[slug]) {
      notFound();
    }
    
    filteredEvents = MARKET_DATA.filter(
      (event) => event.categorySlug === slug
    );
    categoryName = CATEGORY_MAP[slug];
    pageTitle = categoryName;
  }

  // TODO: 根据 activeFilter 筛选数据（暂时只做 UI 切换效果）

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
              {filteredEvents.length > 0 && (
                <div className="flex justify-center py-10 opacity-70">
                  <div className="flex flex-col items-center gap-2">
                    <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

