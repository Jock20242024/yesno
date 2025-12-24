"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORY_FILTERS_CONFIG, FilterOption } from "@/lib/constants/categoryFilters";

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
  count?: number; // 🔥 该分类下的市场数量
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

  // 获取分类列表（包含父子关系）
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/categories");
        const data = await response.json();

        if (data.success && data.data) {
          setCategories(data.data);
          
          // 如果有当前 slug，自动展开并选中对应的分类
          const currentCategory = data.data.find((cat: Category) => cat.slug === slug);
          if (currentCategory) {
            if (currentCategory.parentId) {
              // 如果有父级，展开父级
              setExpandedCategories(new Set([currentCategory.parentId]));
              setSelectedCategory(currentCategory.id);
            } else {
              // 如果是顶级分类，展开它
              setExpandedCategories(new Set([currentCategory.id]));
            }
          }
        }
      } catch (error) {
        console.error("获取分类列表失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [slug]);

  // 🔥 获取筛选选项的市场数量
  useEffect(() => {
    const fetchFilterCounts = async () => {
      if (!CATEGORY_FILTERS_CONFIG[slug]) return;

      try {
        const counts: Record<string, number> = {};
        
        // 为每个筛选选项获取市场数量
        await Promise.all(
          CATEGORY_FILTERS_CONFIG[slug].map(async (filter) => {
            try {
              // 构建查询参数
              const params = new URLSearchParams();
              params.append('category', slug);
              params.append('status', 'OPEN');
              
              // 根据筛选 ID 添加额外筛选条件（如果需要）
              // 例如，15m 可能需要筛选 period=15 的市场
              
              const response = await fetch(`/api/markets?${params.toString()}`);
              const data = await response.json();
              
              if (data.success && Array.isArray(data.data)) {
                // 根据筛选条件过滤市场
                let filteredMarkets = data.data;
                
                // 如果筛选 ID 是周期相关（如 15m, 1h, 4h），需要进一步过滤
                if (filter.id === '15m' || filter.id === '1h' || filter.id === '4h') {
                  const periodMap: Record<string, number> = {
                    '15m': 15,
                    '1h': 60,
                    '4h': 240,
                  };
                  const targetPeriod = periodMap[filter.id];
                  if (targetPeriod) {
                    filteredMarkets = filteredMarkets.filter((market: any) => {
                      return Number(market.period) === targetPeriod || 
                             Number(market.template?.period) === targetPeriod;
                    });
                  }
                }
                
                counts[filter.id] = filteredMarkets.length;
              } else {
                counts[filter.id] = 0;
              }
            } catch (error) {
              console.error(`获取筛选 ${filter.id} 的数量失败:`, error);
              counts[filter.id] = 0;
            }
          })
        );
        
        setFilterCounts(counts);
      } catch (error) {
        console.error("获取筛选数量失败:", error);
      }
    };

    if (slug && CATEGORY_FILTERS_CONFIG[slug]) {
      fetchFilterCounts();
    }
  }, [slug]);

  // 切换分类展开状态
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

  // 处理分类点击
  const handleCategoryClick = (category: Category) => {
    if (category.children && category.children.length > 0) {
      // 如果有子分类，切换展开状态
      toggleCategory(category.id);
    } else {
      // 如果是叶子节点，选中它并显示筛选按钮
      setSelectedCategory(category.id);
    }
  };

  // 获取顶级分类（level 0 或 parentId 为 null）
  const topLevelCategories = categories.filter(
    (cat) => !cat.parentId && (cat.level === 0 || cat.level === undefined)
  );

  // 获取选中分类的子分类（三级分类，用于显示筛选按钮）
  const selectedCategoryData = categories.find((cat) => cat.id === selectedCategory);
  const thirdLevelFilters = selectedCategoryData?.children || [];

  // 检查是否有三级分类的筛选配置
  const hasThirdLevelFilters = thirdLevelFilters.length > 0;

  if (isLoading) {
    return (
      <aside className="w-64 flex-shrink-0 border-r border-white/10 pr-6">
        <div className="text-zinc-400 text-sm">加载中...</div>
      </aside>
    );
  }

  // 如果没有分类数据，不渲染
  if (topLevelCategories.length === 0) {
    return null;
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-white/10 pr-6" style={{ overflow: 'visible' }}>
      {/* 🔥 检查全局 CSS 屏蔽：确保没有 overflow: hidden */}
      {/* 一级和二级分类 - 手风琴模式 */}
      <nav className="space-y-1 mb-6" style={{ overflow: 'visible' }}>
        {topLevelCategories.map((parentCategory) => {
          const isExpanded = expandedCategories.has(parentCategory.id);
          const isSelected = selectedCategory === parentCategory.id;
          const hasChildren = parentCategory.children && parentCategory.children.length > 0;

          return (
            <div key={parentCategory.id}>
              {/* 一级分类 */}
              {/* 🔥 视觉核击：物理强制全量替换渲染函数 */}
              <button
                onClick={() => handleCategoryClick(parentCategory)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isSelected && !hasChildren
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                {/* 左侧：图标和标题 - 物理染色测试：文字改为红色 */}
                <div className="flex items-center gap-3 flex-1">
                  {parentCategory.icon && <span>{parentCategory.icon}</span>}
                  <span className="text-sm font-medium text-red-500">{parentCategory.name}</span>
                </div>
                
                {/* 右侧：物理硬核占位符 - 必须出现在分类文字右侧 */}
                <div style={{ 
                  backgroundColor: '#ff0000', 
                  color: '#ffffff', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  marginLeft: 'auto',
                  display: 'block',
                  zIndex: 9999
                }}>
                  TEST: 888
                </div>
                
                {/* 展开/收起图标 */}
                {hasChildren && (
                  <span className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                )}
              </button>

              {/* 二级分类 - 展开时显示 */}
              {isExpanded && hasChildren && (
                <div className="ml-4 mt-1 space-y-1">
                  {parentCategory.children?.map((childCategory) => {
                    const isChildSelected = selectedCategory === childCategory.id;
                    const hasGrandChildren = childCategory.children && childCategory.children.length > 0;

                    return (
                      <div key={childCategory.id}>
                        <button
                          onClick={() => handleCategoryClick(childCategory)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                            isChildSelected && !hasGrandChildren
                              ? "bg-white/10 text-white"
                              : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                          }`}
                        >
                          {/* 左侧：标题 */}
                          <span className="text-left flex-1">{childCategory.name}</span>
                          
                          {/* 右侧：数量和展开图标 */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* 市场数量 - 像素级还原：使用 ml-auto 确保右对齐 */}
                            <span className={`text-sm font-medium text-[#64748b] ml-auto transition-colors flex-shrink-0 ${
                              isChildSelected && !hasGrandChildren
                                ? "text-white"
                                : "group-hover:text-gray-300"
                            }`}>
                              {childCategory.count ?? 0}
                            </span>
                            
                            {/* 展开/收起图标 */}
                            {hasGrandChildren && (
                              <span className="flex-shrink-0">
                                {expandedCategories.has(childCategory.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* 三级分类 - 如果展开，显示筛选按钮 */}
                        {expandedCategories.has(childCategory.id) && hasGrandChildren && (
                          <div className="ml-4 mt-1 space-y-1">
                            {childCategory.children?.map((grandChild) => {
                              const isGrandChildActive = activeFilter === grandChild.slug;
                              return (
                                <button
                                  key={grandChild.id}
                                  onClick={() => {
                                    setSelectedCategory(grandChild.id);
                                    onFilterChange(grandChild.slug);
                                  }}
                                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                                    isGrandChildActive
                                      ? "bg-primary/20 text-primary border border-primary/50"
                                      : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                                  }`}
                                >
                                  {/* 左侧：标题 */}
                                  <span className="text-left flex-1">{grandChild.name}</span>
                                  
                                  {/* 右侧：市场数量 - 像素级还原：使用 ml-auto 确保右对齐 */}
                                  <span className={`text-sm font-medium text-[#64748b] ml-auto transition-colors flex-shrink-0 ${
                                    isGrandChildActive
                                      ? "text-primary/80"
                                      : "group-hover:text-gray-300"
                                  }`}>
                                    {grandChild.count ?? 0}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 三级分类筛选按钮 - 当选中二级分类时显示在右侧 */}
      {hasThirdLevelFilters && (
        <div className="border-t border-white/10 pt-4">
          <div className="text-xs font-medium text-zinc-400 mb-3 px-4">
            筛选选项
          </div>
          <nav className="space-y-1">
            {thirdLevelFilters.map((filterCategory) => {
              const isFilterActive = activeFilter === filterCategory.slug;
              return (
                <button
                  key={filterCategory.id}
                  onClick={() => onFilterChange(filterCategory.slug)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    isFilterActive
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  {/* 左侧：标题 */}
                  <span className="text-left flex-1">{filterCategory.name}</span>
                  
                  {/* 右侧：市场数量 - 像素级还原：使用 ml-auto 确保右对齐 */}
                  <span className={`text-sm font-medium text-[#64748b] ml-auto transition-colors flex-shrink-0 ${
                    isFilterActive
                      ? "text-primary/80"
                      : "group-hover:text-gray-300"
                  }`}>
                    {filterCategory.count ?? 0}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* 兼容原有的 CATEGORY_FILTERS_CONFIG 配置（如果没有三级分类，使用配置的筛选） */}
      {!hasThirdLevelFilters && CATEGORY_FILTERS_CONFIG[slug] && CATEGORY_FILTERS_CONFIG[slug].length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <div className="text-xs font-medium text-zinc-400 mb-3 px-4">
            筛选选项
          </div>
          <nav className="space-y-1">
            {CATEGORY_FILTERS_CONFIG[slug].map((filter: FilterOption) => {
              const Icon = filter.icon;
              const isFilterActive = activeFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  onClick={() => onFilterChange(filter.id)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    isFilterActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-500 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  {/* 左侧：图标 + 标题 */}
                  <div className="flex items-center gap-3 flex-1">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-left">{filter.label}</span>
                  </div>
                  
                  {/* 右侧：统计数字 - 像素级还原：使用 text-sm 确保与分类数字一致 */}
                  <span className={`text-sm font-medium ml-auto text-[#64748b] flex-shrink-0 ${
                    isFilterActive
                      ? "text-white"
                      : "group-hover:text-gray-300"
                  }`}>
                    {filterCounts[filter.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}
