"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

// 🔥 物理隔离：在组件内部定义，彻底切断与外部配置文件的联系
const LOCAL_TIME_FILTERS = [
  { id: 'all', labelKey: 'common.time.all' },
  { id: '15m', labelKey: 'common.time.15m' },
  { id: '1h', labelKey: 'common.time.1h' },
  { id: '4h', labelKey: 'common.time.4h' },
  { id: '1d', labelKey: 'common.time.1d' },
  { id: '1w', labelKey: 'common.time.1w' },
  { id: '1M', labelKey: 'common.time.1M' },
];

interface TimeFilterTabsProps {
  slug: string;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

export default function TimeFilterTabs({ slug, activeFilter, onFilterChange }: TimeFilterTabsProps) {
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);

  // 🔥 强制客户端渲染：等待挂载后再渲染，彻底解决 Hydration 错误
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔥 调试：监听语言变化和翻译结果
  useEffect(() => {

    LOCAL_TIME_FILTERS.forEach(filter => {
      const translated = t(filter.labelKey);

    });
  }, [language, t]);

  // 🔥 英文和中文 fallback 映射（用于未挂载时和服务端渲染）
  const FALLBACKS: Record<string, { en: string; zh: string }> = {
    'common.time.all': { en: 'All', zh: '全部' },
    'common.time.15m': { en: '15 Mins', zh: '15分钟' },
    'common.time.1h': { en: '1 Hour', zh: '1小时' },
    'common.time.4h': { en: '4 Hours', zh: '4小时' },
    'common.time.1d': { en: 'Daily', zh: '每天' },
    'common.time.1w': { en: 'Weekly', zh: '每周' },
    'common.time.1M': { en: 'Monthly', zh: '每月' },
  };

  // 🔥 强制使用翻译函数的结果，确保显示正确的语言
  const getDisplayText = useCallback((labelKey: string): string => {
    const translated = t(labelKey);

    return translated;
  }, [t, language]);

  // 未挂载时返回占位符，根据当前语言显示对应的 fallback
  if (!mounted) {
    // 🔥 关键修复：在未挂载时，使用当前 language 状态来确定显示哪种语言的 fallback
    const fallbackLang: 'en' | 'zh' = language === 'zh' ? 'zh' : 'en';
    
    return (
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mt-2">
        {LOCAL_TIME_FILTERS.map((filter) => (
          <div
            key={`${filter.id}-${fallbackLang}`}
            className="relative flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium border border-transparent bg-white/5"
          >
            <span suppressHydrationWarning>
              {FALLBACKS[filter.labelKey]?.[fallbackLang] || filter.id}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mt-2" key={`time-filter-tabs-${language}`}>
      {LOCAL_TIME_FILTERS.map((filter) => {
        // 🔥 修复：提取纯筛选器ID（处理 'crypto-15m' 这种情况）
        let pureActiveFilter = activeFilter;
        if (activeFilter.includes('-')) {
          const parts = activeFilter.split('-');
          const lastPart = parts[parts.length - 1];
          if (['15m', '1h', '4h', '1d', '1w', '1M', 'all'].includes(lastPart)) {
            pureActiveFilter = lastPart;
          }
        }
        
        const isActive = pureActiveFilter === filter.id;
        const displayText = getDisplayText(filter.labelKey);

        return (
          <button
            key={`${filter.id}-${language}-${mounted}`}
            onClick={() => {
              onFilterChange(filter.id);
            }}
            className={`relative flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2 ${
              isActive
                ? "bg-primary/20 text-white border-primary/50"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-transparent"
            }`}
          >
            {/* 🔥 强制使用翻译后的文本，使用 key 强制重新渲染 */}
            <span suppressHydrationWarning key={`${filter.id}-text-${language}`}>
              {displayText}
            </span>
            {/* 底部横条：在选中项下方添加绿色横条 */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-b-lg" />
            )}
          </button>
        );
      })}
    </div>
  );
}
