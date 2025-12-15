"use client";

import { CATEGORY_FILTERS_CONFIG, FilterOption } from "@/lib/constants/categoryFilters";

interface FilterSidebarProps {
  slug: string;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

export default function FilterSidebar({
  slug,
  activeFilter,
  onFilterChange,
}: FilterSidebarProps) {
  const filters = CATEGORY_FILTERS_CONFIG[slug];

  // 如果没有配置，不渲染侧边栏
  if (!filters || filters.length === 0) {
    return null;
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-white/10 pr-6">
      <nav className="space-y-1">
        {filters.map((filter: FilterOption) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-left">{filter.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
