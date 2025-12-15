"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Home,
  Building2,
  Bitcoin,
  Trophy,
  DollarSign,
  Cpu,
  LineChart,
} from "lucide-react";

interface CategoryItem {
  slug: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isHighlight?: boolean;
}

const categories: CategoryItem[] = [
  {
    slug: "home",
    label: "数据",
    icon: LineChart,
    isHighlight: false,
  },
  {
    slug: "trending",
    label: "热门",
    icon: Flame,
    isHighlight: true,
  },
  {
    slug: "all",
    label: "所有市场",
    icon: Home,
    isHighlight: true,
  },
  {
    slug: "politics",
    label: "政治",
    icon: Building2,
  },
  {
    slug: "crypto",
    label: "加密货币",
    icon: Bitcoin,
  },
  {
    slug: "sports",
    label: "体育",
    icon: Trophy,
  },
  {
    slug: "finance",
    label: "金融",
    icon: DollarSign,
  },
  {
    slug: "tech",
    label: "科技",
    icon: Cpu,
  },
];

export default function CategoryBar() {
  const pathname = usePathname();

  // 精准匹配函数
  const getIsActive = (slug: string): boolean => {
    if (slug === "home") {
      return pathname === "/";
    }
    return pathname === `/category/${slug}`;
  };

  return (
    <div className="sticky top-[63px] z-40 bg-black/95 backdrop-blur border-b border-border-dark w-full">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 md:px-6 py-2.5">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = getIsActive(category.slug);

          // 数据页 - 普通样式
          if (category.slug === "home") {
            return (
              <Link
                key={category.slug}
                href="/"
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

          // 热门 - 特殊样式
          if (category.slug === "trending") {
            return (
              <Link
                key={category.slug}
                href="/category/trending"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-bold text-xs min-w-max transition-all duration-200 ${
                  isActive
                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_-3px_rgba(236,156,19,0.3)]"
                    : "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_-3px_rgba(236,156,19,0.3)] hover:bg-primary/20 hover:border-primary"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{category.label}</span>
              </Link>
            );
          }

          // 所有市场 - 特殊样式，但使用精准匹配
          if (category.slug === "all") {
            return (
              <Link
                key={category.slug}
                href="/category/all"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs min-w-max transition-all duration-200 ${
                  isActive
                    ? "bg-white/20 text-white border-b-2 border-pm-green"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Icon className="w-4 h-4 fill-current" />
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
        })}
      </div>
    </div>
  );
}

