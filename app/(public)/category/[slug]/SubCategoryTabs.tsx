"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  level?: number;
  parentId?: string | null;
  count?: number; // 🔥 该分类下的市场数量
  children?: Category[];
}

interface SubCategoryTabsProps {
  slug: string;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  onHasSubCategoriesChange?: (hasSubCategories: boolean) => void;
}

export default function SubCategoryTabs({ slug, activeFilter, onFilterChange, onHasSubCategoriesChange }: SubCategoryTabsProps) {
  const { t } = useLanguage();
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allCount, setAllCount] = useState<number>(0); // 🔥 "全部"选项的数量
  const pathname = usePathname();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/categories");
        const data = await response.json();

        if (data.success && data.data) {
          // 查找当前分类
          const currentCategory = data.data.find((cat: Category) => cat.slug === slug);
          
          if (currentCategory && currentCategory.children && currentCategory.children.length > 0) {
            // 如果当前分类有子分类，显示子分类（确保包含 count 字段）
            const childrenWithCount = currentCategory.children.map((child: Category) => ({
              ...child,
              count: child.count ?? 0, // 确保 count 字段存在
            }));
            setSubCategories(childrenWithCount);
            setAllCount(currentCategory.count || 0);
            onHasSubCategoriesChange?.(true);
          } else {
            // 如果没有子分类，检查是否当前分类本身是子分类
            // 如果是，显示同级分类
            if (currentCategory?.parentId) {
              const parent = data.data.find((cat: Category) => cat.id === currentCategory.parentId);
              if (parent?.children && parent.children.length > 0) {
                const siblingsWithCount = parent.children.map((child: Category) => ({
                  ...child,
                  count: child.count ?? 0, // 确保 count 字段存在
                }));
                setSubCategories(siblingsWithCount);
                setAllCount(parent.count || 0);
                onHasSubCategoriesChange?.(true);
              } else {
                setSubCategories([]);
                setAllCount(0);
                onHasSubCategoriesChange?.(false);
              }
            } else {
              setSubCategories([]);
              setAllCount(0);
              onHasSubCategoriesChange?.(false);
            }
          }
        }
      } catch (error) {
        console.error("获取子分类失败:", error);
        setSubCategories([]);
        onHasSubCategoriesChange?.(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [slug, onHasSubCategoriesChange]);

  if (isLoading) {
    return null; // 加载中时不显示
  }

  // 如果没有子分类，不显示标签栏
  if (subCategories.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mt-2">
      {/* "全部" 选项 - 显示当前分类的所有市场 */}
      <button
        onClick={() => {
          onFilterChange("all");
        }}
        className={`relative flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center justify-between gap-2 ${
          activeFilter === "all"
            ? "bg-primary/20 text-white border-primary/50"
            : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-transparent"
        }`}
      >
        {/* 🔥 点击子菜单文字不变颜色，效果跟父级一样 */}
        <span>{t('common.time.all')}</span>
        {/* 🔥 数字格式化：添加小括号，使用较淡的灰色 */}
        <span className="ml-1 text-xs opacity-60 text-[#64748b]">
          ({allCount})
        </span>
        {/* 🔥 底部横条：在选中项下方添加绿色横条，与父级分类物理一致 */}
        {activeFilter === "all" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-b-lg" />
        )}
      </button>
      
      {/* 子分类选项 */}
      {subCategories.map((subCat) => {
        const isActive = activeFilter === subCat.slug;
        
        return (
          <button
            key={subCat.id}
            onClick={() => {
              onFilterChange(subCat.slug);
            }}
            className={`relative flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center justify-between gap-2 ${
              isActive
                ? "bg-primary/20 text-white border-primary/50"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-transparent"
            }`}
          >
            {/* 🔥 点击子菜单文字不变颜色，效果跟父级一样 */}
            <span>{subCat.name}</span>
            {/* 🔥 数字格式化：添加小括号，使用较淡的灰色 */}
            <span className="ml-1 text-xs opacity-60 text-[#64748b]">
              ({subCat.count ?? 0})
            </span>
            {/* 🔥 底部横条：在选中项下方添加绿色横条，与父级分类物理一致 */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-b-lg" />
            )}
          </button>
        );
      })}
    </div>
  );
}
