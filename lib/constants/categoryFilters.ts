import {
  List,
  Clock,
  Hourglass,
  Calendar,
  CalendarDays,
  CalendarRange,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface FilterOption {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number; // 🔥 该筛选选项下的市场数量
  translatedLabel?: string; // 翻译后的标签
}

export interface CategoryFiltersConfig {
  [slug: string]: FilterOption[];
}

export const CATEGORY_FILTERS_CONFIG: CategoryFiltersConfig = {
  crypto: [
    {
      id: "all",
      label: "全部",
      icon: List,
    },
    {
      id: "15m",
      label: "15分钟",
      icon: Clock,
    },
    {
      id: "1h",
      label: "1小时",
      icon: Hourglass,
    },
    {
      id: "4h",
      label: "4小时",
      icon: Clock,
    },
    {
      id: "1d",
      label: "每天",
      icon: Calendar,
    },
    {
      id: "1w",
      label: "每周",
      icon: CalendarDays,
    },
    {
      id: "1M",
      label: "每月",
      icon: CalendarRange,
    },
  ],
  finance: [
    {
      id: "all",
      label: "全部",
      icon: List,
    },
    {
      id: "15m",
      label: "15分钟",
      icon: Clock,
    },
    {
      id: "1h",
      label: "1小时",
      icon: Hourglass,
    },
    {
      id: "4h",
      label: "4小时",
      icon: Clock,
    },
    {
      id: "1d",
      label: "每天",
      icon: Calendar,
    },
    {
      id: "1w",
      label: "每周",
      icon: CalendarDays,
    },
    {
      id: "1M",
      label: "每月",
      icon: CalendarRange,
    },
    {
      id: "premarket",
      label: "盘前",
      icon: Building2,
    },
  ],
};
