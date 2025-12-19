"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  level?: number;
  parentId?: string | null;
  children?: Category[];
}

interface SubCategoryTabsProps {
  slug: string;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

export default function SubCategoryTabs({ slug, activeFilter, onFilterChange }: SubCategoryTabsProps) {
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
            // 如果当前分类有子分类，显示子分类
            setSubCategories(currentCategory.children);
          } else {
            // 如果没有子分类，检查是否当前分类本身是子分类
            // 如果是，显示同级分类
            if (currentCategory?.parentId) {
              const parent = data.data.find((cat: Category) => cat.id === currentCategory.parentId);
              if (parent?.children) {
                setSubCategories(parent.children);
              }
            } else {
              setSubCategories([]);
            }
          }
        }
      } catch (error) {
        console.error("获取子分类失败:", error);
        setSubCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [slug]);

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
        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
          activeFilter === "all"
            ? "bg-primary/20 text-primary border-primary/50"
            : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-transparent"
        }`}
      >
        全部
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
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              isActive
                ? "bg-primary/20 text-primary border-primary/50"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-transparent"
            }`}
          >
            {subCat.name}
          </button>
        );
      })}
    </div>
  );
}
