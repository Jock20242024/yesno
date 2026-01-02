"use client";

import { useState, useEffect, useMemo } from "react";
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
  const { t, language } = useLanguage();
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allCount, setAllCount] = useState<number>(0); // 🔥 "全部"选项的数量
  const [mounted, setMounted] = useState(false); // 🔥 防止服务端渲染时显示内容
  const pathname = usePathname();

  // 🔥 翻译子分类名称 - 使用 useMemo 确保语言切换时重新计算
  const translateSubCategoryName = useMemo(() => {
    return (name: string): string => {
      // 时间相关的子分类翻译映射（支持中文和英文）
      const timeSubCategoryMap: Record<string, string> = {
        '15分钟': 'common.time.15m',
        '30分钟': 'common.time.30m',
        '1小时': 'common.time.1h',
        '4小时': 'common.time.4h',
        '1天': 'common.time.1d',
        '15 Mins': 'common.time.15m',
        '30 Mins': 'common.time.30m',
        '1 Hour': 'common.time.1h',
        '4 Hours': 'common.time.4h',
        '1 Day': 'common.time.1d',
        'Daily': 'common.time.1d',
      };
      
      // 如果找到映射，使用翻译函数
      const translationKey = timeSubCategoryMap[name];
      if (translationKey) {
        const translated = t(translationKey);
        // 如果翻译函数返回了有效的翻译（不是键本身），使用翻译
        if (translated && translated !== translationKey) {
          return translated;
        }
      }
      
      // 如果没有映射，返回原名称
      return name;
    };
  }, [t, language]); // 🔥 依赖 language 确保语言切换时重新创建函数

  // 🔥 防止服务端渲染时显示内容
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        // 🔥 强制禁用缓存，确保获取最新数据
        const response = await fetch("/api/categories", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const data = await response.json();

        console.log('📊 [SubCategoryTabs] API 返回数据:', data);
        console.log('📊 [SubCategoryTabs] 当前 slug:', slug);

        if (data.success && data.data) {
          // 查找当前分类
          const currentCategory = data.data.find((cat: Category) => cat.slug === slug);
          
          console.log('📊 [SubCategoryTabs] 找到的分类:', currentCategory);
          
          if (currentCategory && currentCategory.children && currentCategory.children.length > 0) {
            // 如果当前分类有子分类，显示子分类（确保包含 count 字段）
            const childrenWithCount = currentCategory.children.map((child: Category) => ({
              ...child,
              count: child.count ?? 0, // 确保 count 字段存在
            }));
            console.log('📊 [SubCategoryTabs] 子分类列表:', childrenWithCount);
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
  }, [slug, onHasSubCategoriesChange, t]); // 🔥 语言切换时重新获取数据

  // 🔥 防止服务端渲染时显示内容
  if (!mounted || isLoading) {
    return null; // 未挂载或加载中时不显示
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
            <span>{translateSubCategoryName(subCat.name)}</span>
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
