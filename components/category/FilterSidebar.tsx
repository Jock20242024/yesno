"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// 🔥 物理隔离：本地硬编码筛选器配置，切断与外部配置文件的依赖
const LOCAL_TIME_FILTERS = [
  { id: 'all', labelKey: 'common.time.all' },
  { id: '15m', labelKey: 'common.time.15m' },
  { id: '1h', labelKey: 'common.time.1h' },
  { id: '4h', labelKey: 'common.time.4h' },
  { id: '1d', labelKey: 'common.time.1d' },
  { id: '1w', labelKey: 'common.time.1w' },
  { id: '1M', labelKey: 'common.time.1M' },
];

interface FilterSidebarProps {
  slug: string;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  level?: number;
  parentId?: string | null;
  count?: number; // 🔥 该筛选选项下的市场数量
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  children?: Category[];
}

export default function FilterSidebar({
  slug,
  activeFilter,
  onFilterChange,
}: FilterSidebarProps) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

  // 🔥 物理隔离：使用本地硬编码的筛选器配置，不使用外部 CATEGORY_FILTERS_CONFIG
  // 对于 crypto 和 finance 分类，使用时间筛选器
  const shouldShowTimeFilters = slug === 'crypto' || slug === 'finance';
  const translatedFilters = useMemo(() => {
    if (!shouldShowTimeFilters) return [];
    return LOCAL_TIME_FILTERS.map((filter) => ({
      id: filter.id,
      labelKey: filter.labelKey,
      translatedLabel: t(filter.labelKey),
    }));
  }, [shouldShowTimeFilters, t]);

  // 获取分类列表（包含父子关系）
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/categories");
        const data = await response.json();

        if (data.success && data.data) {
          setCategories(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 获取筛选器数量
  useEffect(() => {
    const fetchFilterCounts = async () => {
      try {
        const response = await fetch(`/api/markets?category=${slug}`);
        const data = await response.json();

        if (data.success && data.data) {
          const counts: Record<string, number> = {};
          data.data.forEach((market: any) => {
            const period = market.period;
            if (period === 15) counts['15m'] = (counts['15m'] || 0) + 1;
            else if (period === 60) counts['1h'] = (counts['1h'] || 0) + 1;
            else if (period === 240) counts['4h'] = (counts['4h'] || 0) + 1;
            else if (period === 1440) counts['1d'] = (counts['1d'] || 0) + 1;
            else if (period === 10080) counts['1w'] = (counts['1w'] || 0) + 1;
            counts['all'] = (counts['all'] || 0) + 1;
          });
          setFilterCounts(counts);
        }
      } catch (error) {
        console.error("Failed to fetch filter counts:", error);
      }
    };

    if (shouldShowTimeFilters) {
      fetchFilterCounts();
    }
  }, [slug, shouldShowTimeFilters]);

  // 切换分类展开/折叠
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // 选择分类
  const selectCategory = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    onFilterChange(categorySlug);
  };

  // 渲染分类树
  const renderCategoryTree = (categoryList: Category[], level: number = 0) => {
    return categoryList.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.id);
      const isSelected = selectedCategory === category.slug || activeFilter === category.slug;

      return (
        <div key={category.id}>
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              isSelected
                ? "bg-primary/20 text-primary border border-primary/50"
                : "text-text-secondary hover:text-white hover:bg-white/5"
            }`}
            style={{ paddingLeft: `${12 + level * 16}px` }}
            onClick={() => selectCategory(category.slug)}
          >
            <span className="text-sm font-medium">{category.name}</span>
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.id);
                }}
                className="ml-2 p-1 hover:bg-white/10 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {category.count !== undefined && (
              <span className="ml-2 text-xs text-text-secondary">
                ({category.count})
              </span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderCategoryTree(category.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 时间筛选器 - 仅对 crypto 和 finance 显示 */}
      {shouldShowTimeFilters && translatedFilters.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {t('common.time.title') || 'Time Filter'}
          </h3>
          <div className="flex flex-col gap-2">
            {translatedFilters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => onFilterChange(filter.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "text-text-secondary hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {/* 🔥 关键：suppressHydrationWarning + t() 翻译 */}
                  <span suppressHydrationWarning>
                    {filter.translatedLabel || filter.id}
                  </span>
                  {filterCounts[filter.id] !== undefined && (
                    <span className="text-xs text-text-secondary">
                      ({filterCounts[filter.id]})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 分类树 */}
      {!isLoading && categories.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Categories
          </h3>
          <div className="flex flex-col gap-1">
            {renderCategoryTree(categories)}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-text-secondary text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
}
