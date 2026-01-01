"use client";

import MarketTable from "@/components/MarketTable";
import MarketOverview from "@/components/MarketOverview";
import { Globe, TrendingUp, Shield } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * 首页 - 完全客户端渲染，从 API 获取数据
 * 
 * 🔥 核心修复：移除了 MARKET_DATA Mock 数据
 * 现在 MarketTable 完全从 API 获取数据，确保显示最新内容
 */
export default function LandingPage() {
  const { t } = useLanguage();
  
  return (
    <div className="layout-container flex h-full grow flex-col w-full lg:max-w-[1440px] lg:mx-auto px-4 lg:px-10 py-8">
      {/* Hero Section */}
      <section className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10 pb-8 border-b border-border-dark">
        <div className="flex flex-col gap-4 max-w-[720px]">
          <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
            <span className="text-primary">{t('home.hero.title_prefix')}</span>, {t('home.hero.title_suffix')}
          </h1>
          <p className="text-text-secondary text-lg font-normal leading-normal max-w-[600px]">
            {t('home.hero.subtitle')}
          </p>
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark whitespace-nowrap">
              <Globe className="w-[18px] h-[18px] text-primary flex-shrink-0" />
              {t('home.hero.feature_global')}
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark whitespace-nowrap">
              <TrendingUp className="w-[18px] h-[18px] text-primary flex-shrink-0" />
              {t('home.hero.feature_odds')}
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark px-3 py-1.5 rounded-full border border-border-dark whitespace-nowrap">
              <Shield className="w-[18px] h-[18px] text-primary flex-shrink-0" />
              {t('home.hero.feature_security')}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左侧：排行榜 - 75% */}
        <main className="lg:col-span-9 flex flex-col gap-6">
          {/* 🔥 不传递 data prop，让 MarketTable 完全从 API 获取数据 */}
          <MarketTable />
        </main>
        
        {/* 右侧：市场概览 - 25% */}
        <aside className="lg:col-span-3 flex flex-col gap-6">
          {/* 占位区域，与左侧标题区域高度一致 */}
          <div className="h-[52px]">
            {/* 空占位，确保右侧面板顶部边框与左侧表格容器顶部边框对齐 */}
          </div>
          <div className="sticky top-24">
            <MarketOverview />
          </div>
        </aside>
      </div>
    </div>
  );
}

