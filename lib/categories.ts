// 分类映射：slug -> 中文名称
export const CATEGORY_MAP: Record<string, string> = {
  politics: "政治",
  sports: "体育",
  crypto: "加密货币",
  finance: "金融",
  tech: "科技",
  entertainment: "娱乐",
  business: "商业",
};

// 反向映射：中文名称 -> slug
export const CATEGORY_SLUG_MAP: Record<string, string> = {
  政治: "politics",
  体育: "sports",
  加密货币: "crypto",
  金融: "finance",
  科技: "tech",
  娱乐: "entertainment",
  商业: "business",
};

// 导航栏分类配置
export interface NavCategory {
  slug: string;
  label: string;
  icon?: string | null;
  highlight?: boolean;
}

export const NAV_CATEGORIES: NavCategory[] = [
  { slug: "trending", label: "热门", icon: "🔥", highlight: true },
  { slug: "all", label: "所有市场", icon: null, highlight: false },
  { slug: "politics", label: "政治", icon: null, highlight: false },
  { slug: "sports", label: "体育", icon: null, highlight: false },
  { slug: "crypto", label: "加密货币", icon: null, highlight: false },
];

