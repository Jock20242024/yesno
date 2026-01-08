"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface CategoryItem {
  slug: string;
  label: string;
  icon: LucideIcon;
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

// 🔥 强制英文对齐：定义初始语言常量
const INITIAL_LANG = 'en' as const;

export default function CategoryBar() {
  const pathname = usePathname();
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoriesData, setCategoriesData] = useState<ApiCategory[]>([]);

  // 🔥 修复 Hydration 错误：等待客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔥 强制英文对齐：翻译辅助函数，确保未挂载时返回英文
  const getTranslation = useCallback((key: string, fallback: string): string => {
    return mounted ? t(key) : fallback;
  }, [mounted, t]);

  // 固定分类（系统内置）- 包含"数据"和"热门"
  const fixedCategories: CategoryItem[] = useMemo(() => [
    {
      slug: "data",
      label: mounted ? t('home.categories.data') : 'Data',
      icon: Icons.LineChart,
      isHighlight: false,
    },
    {
      slug: "hot",
      label: mounted ? t('home.categories.hot') : 'Trending',
      icon: Icons.Flame,
      isHighlight: true, // 🔥 热门标签高亮显示
    },
  ], [t, mounted]);

  // 默认分类（当数据库为空时的 fallback）- 🔥 强制英文对齐
  const defaultCategories: CategoryItem[] = useMemo(() => [
    {
      slug: "crypto",
      label: mounted ? t('home.categories.crypto') : 'Crypto',
      icon: Icons.Bitcoin,
      isHighlight: false,
    },
    {
      slug: "politics",
      label: mounted ? t('home.categories.politics') : 'Politics',
      icon: Icons.Building2,
      isHighlight: false,
    },
    {
      slug: "sports",
      label: mounted ? t('home.categories.sports') : 'Sports',
      icon: Icons.Trophy,
      isHighlight: false,
    },
    {
      slug: "finance",
      label: mounted ? t('home.categories.finance') : 'Finance',
      icon: Icons.DollarSign,
      isHighlight: false,
    },
    {
      slug: "technology",
      label: mounted ? t('home.categories.technology') : 'Technology',
      icon: Icons.Cpu,
      isHighlight: false,
    },
  ], [t, mounted]);

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
            // 🔥 同时过滤掉"热门"分类（slug 为 "hot" 或 "-1"），因为已经在固定分类中定义了
            const topLevelCategories = data.data.filter(
              (cat: ApiCategory & { level?: number; parentId?: string | null }) =>
                !cat.parentId && 
                (cat.level === 0 || cat.level === undefined) &&
                cat.slug !== "hot" && 
                cat.slug !== "-1" &&
                cat.name !== "热门"
            );
            
            const apiCategories: CategoryItem[] = topLevelCategories
              .sort((a: ApiCategory & { sortOrder?: number }, b: ApiCategory & { sortOrder?: number }) => {
                // 优先使用 sortOrder，如果不存在则使用 displayOrder
                const aOrder = a.sortOrder !== undefined ? a.sortOrder : a.displayOrder;
                const bOrder = b.sortOrder !== undefined ? b.sortOrder : b.displayOrder;
                return aOrder - bOrder;
              })
              .map((cat: ApiCategory) => {
                // 🔥 动态获取图标组件：优先使用 slug="hot" 或 "-1" 的判断，否则使用数据库中的 icon 字段
                let IconComponent: LucideIcon;
                if (cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门") {
                  // 如果是"热门"分类，强制使用 Flame 图标
                  IconComponent = Icons.Flame;
                } else {
                  // 其他分类：从数据库的 icon 字段动态获取图标
                  IconComponent = getIconComponent(cat.icon);
                }

                // 🔥 强制英文对齐：翻译分类名称，优先使用翻译键，如果不存在则使用英文 fallback（不使用数据库中的中文 name）
                let translatedLabel: string;
                
                // 🔥 英文 fallback 映射（根据常见分类 slug）
                const englishFallbacks: Record<string, string> = {
                  'crypto': 'Crypto',
                  'politics': 'Politics',
                  'sports': 'Sports',
                  'finance': 'Finance',
                  'technology': 'Technology',
                  'tech': 'Tech',
                };
                
                if (cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门") {
                  translatedLabel = getTranslation('home.categories.hot', 'Trending');
                } else {
                  // 🔥 强制根据 slug 查找翻译键（如 home.categories.crypto, home.categories.politics 等）
                  const translationKey = `home.categories.${cat.slug}`;
                  // 🔥 使用英文 fallback，而不是数据库中的 cat.name（可能是中文）
                  const fallback = englishFallbacks[cat.slug] || cat.slug.charAt(0).toUpperCase() + cat.slug.slice(1);
                  const translated = getTranslation(translationKey, fallback);
                  
                  // 🔥 如果翻译键存在且返回的不是 key 本身，使用翻译；否则使用英文 fallback
                  if (translated && translated !== translationKey) {
                    translatedLabel = translated;
                  } else {
                    // 🔥 如果翻译不存在，使用英文 fallback（不使用数据库中的中文 name）
                    translatedLabel = fallback;
                  }
                }

                return {
                  slug: cat.slug === "-1" ? "hot" : cat.slug, // 🔥 修复：将数据库中的 -1 转换为 hot 用于路由
                  label: translatedLabel,
                  icon: IconComponent,
                  isHighlight: cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门", // 热门分类高亮显示
                };
              });

            setCategoriesData(topLevelCategories);

          }
        }
      } catch (error) {
        console.error("❌ [CategoryBar] 获取分类列表失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 🔥 关键修复：当语言变化时，重新翻译分类名称
  useEffect(() => {
    if (categoriesData.length > 0) {
      const apiCategories: CategoryItem[] = categoriesData
        .sort((a: ApiCategory & { sortOrder?: number }, b: ApiCategory & { sortOrder?: number }) => {
          const aOrder = a.sortOrder !== undefined ? a.sortOrder : a.displayOrder;
          const bOrder = b.sortOrder !== undefined ? b.sortOrder : b.displayOrder;
          return aOrder - bOrder;
        })
        .map((cat: ApiCategory) => {
          let IconComponent: LucideIcon;
          if (cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门") {
            IconComponent = Icons.Flame;
          } else {
            IconComponent = getIconComponent(cat.icon);
          }

          let translatedLabel: string;
          const englishFallbacks: Record<string, string> = {
            'crypto': 'Crypto',
            'politics': 'Politics',
            'sports': 'Sports',
            'finance': 'Finance',
            'technology': 'Technology',
            'tech': 'Tech',
            '突发': 'Breaking', // 🔥 修复：添加"突发"的英文fallback
          };
          
          // 🔥 修复：优先使用数据库中的nameZh字段（如果存在且语言为中文）
          if (language === 'zh' && (cat as any).nameZh) {
            translatedLabel = (cat as any).nameZh;
          } else if (cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门") {
            translatedLabel = getTranslation('home.categories.hot', 'Trending');
          } else {
            const translationKey = `home.categories.${cat.slug}`;
            const fallback = englishFallbacks[cat.slug] || cat.name || cat.slug.charAt(0).toUpperCase() + cat.slug.slice(1);
            const translated = getTranslation(translationKey, fallback);
            
            if (translated && translated !== translationKey) {
              translatedLabel = translated;
            } else {
              // 🔥 修复：如果语言为英文且没有翻译，使用数据库中的name字段（可能是英文）
              translatedLabel = language === 'en' ? (cat.name || fallback) : fallback;
            }
          }

          return {
            slug: cat.slug === "-1" ? "hot" : cat.slug,
            label: translatedLabel,
            icon: IconComponent,
            isHighlight: cat.slug === "hot" || cat.slug === "-1" || cat.name === "热门",
          };
        });

      setDynamicCategories(apiCategories);
    } else if (!isLoading) {
      setDynamicCategories(defaultCategories);
    }
  }, [categoriesData, language, getTranslation, defaultCategories, isLoading]);

  // 合并固定分类和动态分类
  const categories = useMemo(() => [...fixedCategories, ...dynamicCategories], [fixedCategories, dynamicCategories]);

  // 精准匹配函数
  const getIsActive = (slug: string): boolean => {
    if (slug === "data") {
      return pathname === "/data";
    }
    if (slug === "hot" || slug === "-1") {
      // 🔥 修复：热门应该跳转到分类页面，而不是 /data
      return pathname === "/category/hot" || pathname === "/category/-1" || pathname === "/markets?category=hot";
    }
    return pathname === `/category/${slug}`;
  };

  return (
    <div className="sticky top-[63px] z-40 bg-black/95 backdrop-blur border-b border-border-dark w-full">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 md:px-6 py-2.5">
        {isLoading ? (
          <div className="text-zinc-400 text-xs whitespace-nowrap" suppressHydrationWarning>
            {mounted ? t('home.categories.loading') : 'Loading categories...'}
          </div>
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
                <span suppressHydrationWarning>{category.label}</span>
              </Link>
            );
          }

          // 热门 - 从数据库获取，使用特殊样式（火焰跳动效果）
          // 🔥 修复：支持数据库中的 -1 slug
          if (category.slug === "hot" || category.slug === "-1") {
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
                    {...({ color: '#f97316', strokeWidth: 2.5 } as any)}
                  />
                </div>
                <span suppressHydrationWarning>{category.label}</span>
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
              <span suppressHydrationWarning>{category.label}</span>
            </Link>
          );
          })
        )}
      </div>
    </div>
  );
}

