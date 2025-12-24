"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";

interface CategoryItem {
  slug: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isHighlight?: boolean;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  displayOrder: number;
  sortOrder?: number;
  children?: Array<{
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
    sortOrder?: number;
  }>;
}

// 🔥 动态获取图标组件：从 Lucide 库中直接获取，支持所有图标
const getIconComponent = (iconName: string | null | undefined): LucideIcon => {
  // 如果没有提供图标名称，返回默认的 Home 图标
  if (!iconName) {
    return Icons.Home;
  }
  
  // 尝试从 Lucide 库中直接获取组件（支持所有图标）
  const IconComponent = (Icons as any)[iconName] as LucideIcon;
  
  // 如果找到了就返回，找不到就返回默认的 Home 图标
  if (IconComponent) {
    return IconComponent;
  }
  
  // 如果找不到，返回默认图标
  return Icons.Home;
};

// 固定分类（系统内置）- 只保留"数据"，"热门"从数据库获取
const fixedCategories: CategoryItem[] = [
  {
    slug: "data",
    label: "数据",
    icon: Icons.LineChart,
    isHighlight: false,
  },
];

// 默认分类（当数据库为空时的 fallback）
const defaultCategories: CategoryItem[] = [
  {
    slug: "crypto",
    label: "加密货币",
    icon: Icons.Bitcoin,
    isHighlight: false,
  },
  {
    slug: "politics",
    label: "政治",
    icon: Icons.Building2,
    isHighlight: false,
  },
  {
    slug: "sports",
    label: "体育",
    icon: Icons.Trophy,
    isHighlight: false,
  },
  {
    slug: "finance",
    label: "金融",
    icon: Icons.DollarSign,
    isHighlight: false,
  },
  {
    slug: "technology",
    label: "科技",
    icon: Icons.Cpu,
    isHighlight: false,
  },
];

export default function CategoryBar() {
  const pathname = usePathname();
  const [dynamicCategories, setDynamicCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 从 API 获取分类列表
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/categories");

        const data = await response.json();

        if (data.success && data.data) {
          // 如果 API 返回了分类，使用 API 的数据
          if (data.data.length > 0) {
            // 🔥 只显示顶级分类（level 0 或 parentId 为 null）用于导航栏
            const topLevelCategories = data.data.filter(
              (cat: ApiCategory & { level?: number; parentId?: string | null }) =>
                !cat.parentId && (cat.level === 0 || cat.level === undefined)
            );
            
            const apiCategories: CategoryItem[] = topLevelCategories
              .sort((a: ApiCategory & { sortOrder?: number }, b: ApiCategory & { sortOrder?: number }) => {
                // 优先使用 sortOrder，如果不存在则使用 displayOrder
                const aOrder = a.sortOrder !== undefined ? a.sortOrder : a.displayOrder;
                const bOrder = b.sortOrder !== undefined ? b.sortOrder : b.displayOrder;
                return aOrder - bOrder;
              })
              .map((cat: ApiCategory) => {
                // 🔥 动态获取图标组件：优先使用 slug="hot" 的判断，否则使用数据库中的 icon 字段
                let IconComponent: LucideIcon;
                if (cat.slug === "hot") {
                  // 如果是"热门"分类，强制使用 Flame 图标
                  IconComponent = Icons.Flame;
                } else {
                  // 其他分类：从数据库的 icon 字段动态获取图标
                  IconComponent = getIconComponent(cat.icon);
                }

                return {
                  slug: cat.slug,
                  label: cat.name,
                  icon: IconComponent,
                  isHighlight: cat.slug === "hot", // 热门分类高亮显示
                };
              });

            setDynamicCategories(apiCategories);
            console.log(`✅ [CategoryBar] 已加载 ${apiCategories.length} 个动态分类`);
          } else {
            // 🔥 Fallback：如果数据库为空，使用默认分类
            console.warn('⚠️ [CategoryBar] 数据库为空，使用默认分类');
            setDynamicCategories(defaultCategories);
          }
        } else {
          console.warn('⚠️ [CategoryBar] API 返回数据格式错误，使用默认分类:', data);
          setDynamicCategories(defaultCategories);
        }
      } catch (error) {
        console.error("❌ [CategoryBar] 获取分类列表失败，使用默认分类:", error);
        // 🔥 Fallback：API 调用失败时使用默认分类
        setDynamicCategories(defaultCategories);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 合并固定分类和动态分类
  const categories = [...fixedCategories, ...dynamicCategories];

  // 精准匹配函数
  const getIsActive = (slug: string): boolean => {
    if (slug === "data") {
      return pathname === "/data";
    }
    if (slug === "hot") {
      // 🔥 修复：热门应该跳转到分类页面，而不是 /data
      return pathname === "/category/hot" || pathname === "/markets?category=hot";
    }
    return pathname === `/category/${slug}`;
  };

  return (
    <div className="sticky top-[63px] z-40 bg-black/95 backdrop-blur border-b border-border-dark w-full">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 md:px-6 py-2.5">
        {isLoading ? (
          <div className="text-zinc-400 text-xs">加载分类中...</div>
        ) : (
          categories.map((category) => {
          const Icon = category.icon;
          const isActive = getIsActive(category.slug);

          // 数据页 - 固定样式
          if (category.slug === "data") {
            return (
              <Link
                key={category.slug}
                href="/data"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs min-w-max transition-all duration-200 ${
                  isActive
                    ? "text-white bg-zinc-800 border-b-2 border-pm-green"
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{category.label}</span>
              </Link>
            );
          }

          // 热门 - 从数据库获取，使用特殊样式（火焰跳动效果）
          if (category.slug === "hot") {
            return (
              <Link
                key={category.slug}
                href="/category/hot"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-bold text-xs min-w-max transition-all duration-200 ${
                  isActive
                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_-3px_rgba(236,156,19,0.3)] border-b-2 border-primary"
                    : "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_-3px_rgba(236,156,19,0.3)] hover:bg-primary/20 hover:border-primary"
                }`}
              >
                <div className="flame-icon-wrapper">
                  <Icon 
                    className="w-4 h-4 flame-icon" 
                    style={{
                      color: '#f97316',
                      filter: 'drop-shadow(0 0 8px rgba(249, 115, 22, 1)) drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))',
                      strokeWidth: 2.5,
                    }}
                  />
                </div>
                <span>{category.label}</span>
              </Link>
            );
          }

          // 普通分类 - 优化样式
          return (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs min-w-max transition-all duration-200 ${
                isActive
                  ? "text-white bg-zinc-800 border-b-2 border-pm-green"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{category.label}</span>
            </Link>
          );
          })
        )}
      </div>
    </div>
  );
}

