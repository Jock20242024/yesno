"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// 🔥 恢复数据库子分类设计：移除所有硬编码的时间过滤器

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
  // 🔥 恢复数据库子分类设计：移除所有硬编码的时间过滤器逻辑
  // 只显示数据库中的子分类

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

  // 🔥 恢复数据库子分类设计：移除时间过滤器的数量统计逻辑
  // 子分类的数量已经通过 /api/categories 返回的 count 字段获取

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

  // 🔥 恢复数据库子分类设计：只显示数据库中的分类树，不显示硬编码的时间过滤器
  // 查找当前分类及其子分类
  const currentCategory = useMemo(() => {
    return categories.find(cat => cat.slug === slug);
  }, [categories, slug]);

  return (
    <div className="flex flex-col gap-6">
      {/* 分类树 - 只显示数据库中的分类 */}
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

      {/* 如果当前分类有子分类，显示子分类 */}
      {!isLoading && currentCategory && currentCategory.children && currentCategory.children.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Subcategories
          </h3>
          <div className="flex flex-col gap-1">
            {currentCategory.children.map((child) => {
              const isActive = activeFilter === child.slug;
              return (
                <button
                  key={child.id}
                  onClick={() => selectCategory(child.slug)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "text-text-secondary hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span>{child.name}</span>
                  {child.count !== undefined && (
                    <span className="text-xs text-text-secondary">
                      ({child.count})
                    </span>
                  )}
                </button>
              );
            })}
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
