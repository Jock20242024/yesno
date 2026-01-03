'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Market } from "@/types/api";
import { MarketEvent } from "@/lib/data";
import MarketCard from "@/components/MarketCard";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSearchParams } from "next/navigation";
import SubCategoryTabs from "./SubCategoryTabs";

interface CategoryClientProps {
  slug: string;
  categoryName: string;
  pageTitle: string;
  hasFilters: boolean; // 保留此字段以兼容，但不再使用
}

// 将 volume 字符串转换为数字用于排序
function parseVolume(volume?: string): number {
  if (!volume) return 0;
  
  // 🔥 修复：确保在调用 replace 之前先转换为字符串
  const cleaned = String(volume || '').replace(/[$,\s]/g, "").toLowerCase();
  const match = cleaned.match(/^([\d.]+)([km]?)$/);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const unit = match[2];
  
  if (unit === "k") return num * 1000;
  if (unit === "m") return num * 1000000;
  return num;
}

export default function CategoryClient({ slug, categoryName, pageTitle, hasFilters }: CategoryClientProps) {
  // 架构加固：Page/ClientPage 级别读取 Context，通过 props 传给子组件
  const { isLoggedIn } = useAuth();
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  
  // 🔥 翻译分类名称 - 使用 useMemo 确保语言切换时重新计算
  const translatedCategoryName = useMemo(() => {
    // 根据 slug 查找翻译键
    const categoryTranslationMap: Record<string, string> = {
      'crypto': 'home.categories.crypto',
      'politics': 'home.categories.politics',
      'sports': 'home.categories.sports',
      'finance': 'home.categories.finance',
      'tech': 'home.categories.tech',
      'technology': 'home.categories.technology',
      'hot': 'home.categories.hot',
      'trending': 'home.categories.trending',
      'data': 'home.categories.data',
    };
    
    // 如果找到翻译键，使用翻译
    const translationKey = categoryTranslationMap[slug];
    if (translationKey) {
      const translated = t(translationKey);
      // 如果翻译函数返回了有效的翻译（不是键本身），使用翻译
      if (translated && translated !== translationKey) {
        return translated;
      }
    }
    
    // 如果没有找到翻译键，返回原名称（数据库中的名称）
    return categoryName;
  }, [slug, categoryName, t, language]);
  
  // activeFilter 用于子分类筛选："all" 表示显示全部，其他值表示子分类 slug
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [marketData, setMarketData] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSubCategories, setHasSubCategories] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // 🔥 修复 Hydration 错误：等待客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔥 恢复数据库子分类设计：移除硬编码的时间过滤器映射
  // 所有子分类（包括15分钟、每日、每月等）都应该存储在数据库中，通过后台管理

  // 获取市场数据
  const fetchMarkets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      // 🔥 获取 URL 中的搜索参数
      // 🔥 参数验证：确保 searchQuery 不为空字符串
      const searchQuery = searchParams.get('search');
      if (searchQuery && searchQuery.trim() !== '') {
        params.append("search", searchQuery);
      }
      
      // 🔥 恢复数据库子分类设计：所有筛选都通过 category 参数（子分类的 slug）
      if (slug === "hot" || slug === "trending") {
        params.append("category", "hot");
      } else {
        // 普通分类页面：如果选择了子分类，使用子分类的 slug；否则使用父分类的 slug
        // 🔥 参数验证：确保 activeFilter 和 slug 不为空
        if (activeFilter && activeFilter !== "all" && activeFilter !== slug && slug) {
          // 选择了子分类，使用子分类的 slug
          params.append("category", activeFilter);
        } else if (slug && slug.trim() !== '') {
          // 选择了"全部"或父分类本身，使用父分类的 slug
          params.append("category", slug);
        }
      }

      // 🚀 强制禁用缓存，确保获取最新数据（解决删除后前端仍显示的问题）
      const response = await fetch(`/api/markets?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch markets");
      }

      const result = await response.json();
      
      // 🔥 物理调试：打印 API 返回的原始数据

      // 🔥 详细打印每个市场的关键字段
      if (result.data && result.data.length > 0) {

      }
      
      if (result.success && result.data) {
        let markets = result.data;
        
        // 🔥 物理调试：打印处理前的数据长度

        // 🚀 第三步：统一前端统计与渲染逻辑
        // 物理重写：不再对API返回的数据做任何关于时间或状态的二次过滤
        // API已经应用了BASE_MARKET_FILTER，返回的数据都是有效的
        // 前端只保留必要的isActive防御性检查（仅用于日志记录，不实际过滤）
        markets.forEach((m: any) => {
          if (m.isActive === false) {
            console.warn(`🚨 [CategoryClient] 发现 isActive=false 的市场（应该已被后端过滤）: ${m.id} (${m.title})`);
          }
        });
        
        // 🚀 物理重写：如果是"全部"标签，使用完整的markets数组，不进行任何过滤
        // 确保Tab上显示的数字等于API返回的markets.length
        setMarketData(markets);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('category.error'));
      console.error("Error fetching markets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    // 🔥 注意：searchParams 是对象，需要将其转换为字符串依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, activeFilter, searchParams?.get('search')]);

  // 将 Market 类型转换为 MarketEvent 类型
  const convertMarketToEvent = (market: Market): MarketEvent & { originalId?: string } => {
    const getSafeDeadline = (dateValue?: string | Date): string => {
      if (!dateValue) return "待定";
      
      try {
        // 🔥 安全日期处理：确保输入是有效值
        if (typeof dateValue === 'string' && dateValue.trim() === '') {
          return "待定";
        }
        
        const date = new Date(dateValue);
        
        // 🔥 检查是否为无效日期
        if (isNaN(date.getTime())) {
          console.warn('⚠️ [CategoryClient] 无效日期值:', dateValue);
          return "待定";
        }
        
        // 🔥 检查日期是否在合理范围内（1970-2100）
        const year = date.getFullYear();
        if (year < 1970 || year > 2100) {
          console.warn('⚠️ [CategoryClient] 日期超出合理范围:', dateValue, '年份:', year);
          return "待定";
        }
        
        return date.toISOString().split("T")[0];
      } catch (error) {
        console.error('❌ [CategoryClient] 日期解析错误:', dateValue, error);
        return "待定";
      }
    };

    const dateValue = (market as any).endTime || (market as any).closingDate;

    let numericId: number;
    try {
      const uuidParts = market.id.split('-');
      numericId = parseInt(uuidParts[0], 16) || 1;
    } catch {
      numericId = 1;
    }

    // 🔥 修复：强制从 API 返回的数据读取，不使用默认值 50
    // 🚀 第一优先级：解析 outcomePrices（数据库真实数据）
    let yesPercent: number = 50;
    let noPercent: number = 50;
    
    try {
      const outcomePrices = (market as any).outcomePrices;
      if (outcomePrices) {
        const prices = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
        if (Array.isArray(prices) && prices.length > 0 && prices[0]) {
          const yesPrice = parseFloat(prices[0]);
          if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
            yesPercent = Math.round(yesPrice * 100);
            noPercent = 100 - yesPercent;
          }
        }
      }
    } catch (e) {
      // JSON 解析失败，继续下一个优先级
    }
    
    // 🚀 第二优先级：使用 initialPrice（数据库真实数据）
    if (yesPercent === 50 && noPercent === 50) {
      const initialPrice = (market as any).initialPrice;
      if (typeof initialPrice === 'number' && !isNaN(initialPrice) && initialPrice >= 0 && initialPrice <= 1) {
        yesPercent = Math.round(initialPrice * 100);
        noPercent = 100 - yesPercent;
      }
    }
    
    // 🚀 第三优先级：使用 API 返回的 yesPercent/noPercent
    if (yesPercent === 50 && noPercent === 50) {
      if (typeof market.yesPercent === 'number' && !isNaN(market.yesPercent) && 
          typeof market.noPercent === 'number' && !isNaN(market.noPercent)) {
        yesPercent = market.yesPercent;
        noPercent = market.noPercent;
      }
    }
    
    // 🚀 最后兜底：从 totalYes 和 totalNo 计算
    if (yesPercent === 50 && noPercent === 50) {
      const totalYes = (market as any).totalYes || 0;
      const totalNo = (market as any).totalNo || 0;
      const totalAmount = totalYes + totalNo;
      
      if (totalAmount > 0) {
        yesPercent = Math.round((totalYes / totalAmount) * 100);
        noPercent = Math.round((totalNo / totalAmount) * 100);
      } else {
        // 最后兜底：使用 50/50（但会记录警告）
        console.warn(`⚠️ [CategoryClient] 市场 ${market.id} 没有交易数据，使用默认 50/50`);
      }
    }

    // 🔥 核心修复：图片优先级（保留原始图片字段，不做任何覆盖）
    // 优先级 1: originalImage 或 scrapedImage（爬虫抓取的原始配图）
    const originalImage = (market as any).image || (market as any).originalImage || (market as any).scrapedImage || (market as any).iconUrl || '';
    
    // 🔥 图标匹配逻辑（只在没有图片时使用）
    // 优先级 2: assetIcon（如果是加密货币，显示币种图标）
    // 优先级 3: categoryIcon（如果前两者都没有，显示分类图标）
    let iconName = "Bitcoin";
    let iconColor = "bg-[#f7931a]";
    
    // 只有在没有原始图片时才需要匹配图标
    // 🔥 修正：不强制校验 templateId 是否存在，只要 API 返回了数据就渲染
    if (!originalImage || originalImage.trim() === '') {
      // 🔥 核心修复：独立市场（templateId === null）必须根据分类显示图标
      const isIndependentMarket = !(market as any).templateId;
      
      // 🔥 修正：独立市场使用分类图标，工厂市场使用币种图标
      if (!isIndependentMarket && ((market as any).templateId || (market as any).isFactory)) {
        // 工厂市场：根据 symbol/asset 匹配币种图标
        const symbol = ((market as any).symbol || (market as any).asset || '').toUpperCase();
        const title = (market.title || '').toUpperCase();
        
        if (symbol.includes('BTC') || title.includes('BTC') || title.includes('比特币')) {
          iconName = 'Bitcoin';
          iconColor = 'bg-[#f7931a]';
        } else if (symbol.includes('ETH') || title.includes('ETH') || title.includes('以太坊')) {
          iconName = 'Coins';
          iconColor = 'bg-[#627EEA]';
        } else {
          iconName = 'Coins';
          iconColor = 'bg-[#627EEA]';
        }
      } else {
        // 独立市场：根据分类匹配图标
        const categorySlug = (market.categorySlug || '').toLowerCase();
        const category = (market.category || '').toLowerCase();
        
        if (categorySlug.includes('politic') || category.includes('政治')) {
          iconName = 'Building2';
          iconColor = 'bg-blue-800';
        } else if (categorySlug.includes('sport') || category.includes('体育')) {
          iconName = 'Trophy';
          iconColor = 'bg-orange-600';
        } else if (categorySlug.includes('tech') || category.includes('科技')) {
          iconName = 'Bot';
          iconColor = 'bg-purple-600';
        } else if (categorySlug.includes('finance') || category.includes('金融')) {
          iconName = 'Building2';
          iconColor = 'bg-blue-800';
        } else if (categorySlug.includes('crypto') || category.includes('加密货币')) {
          iconName = 'Coins';
          iconColor = 'bg-[#627EEA]';
        }
      }
    }

    // 🔥 根据语言环境显示对应的标题（实时翻译在 MarketCard 组件中处理）
    const displayTitle = (() => {
      const marketAny = market as any;
      if (language === 'zh' && marketAny.titleZh) {
        return marketAny.titleZh;
      }
      return market.title;
    })();
    
    return {
      id: numericId,
      rank: 1,
      title: displayTitle, // 🔥 使用根据语言环境选择的标题
      category: market.category || '未分类',
      categorySlug: market.categorySlug || 'all',
      icon: iconName,
      iconColor: iconColor,
      yesPercent,
      noPercent,
      deadline: getSafeDeadline(dateValue),
      imageUrl: originalImage, // 🔥 使用原始图片（优先级 1）
      // 🔥 修复：优先使用 volume24h，然后 volume，最后 displayVolume
      volume: formatVolume((market as any).volume24h || market.volume || market.displayVolume),
      comments: market.commentsCount || 0,
      originalId: market.id,
      // 🔥 添加原始数据字段（传递给 MarketCard 使用）
      outcomePrices: (market as any).outcomePrices || null,
      image: (market as any).image || null,
      iconUrl: (market as any).iconUrl || null,
      initialPrice: (market as any).initialPrice || null,
      volume24h: (market as any).volume24h || null,
      totalVolume: (market as any).totalVolume || null,
      externalVolume: (market as any).externalVolume || null,
      // 🔥 添加 currentPrice 字段（用于卡片计算赔率）
      ...((market as any).currentPrice && { currentPrice: (market as any).currentPrice }),
      // 🔥 添加模板相关信息，用于图标匹配
      templateId: (market as any).templateId || null,
      isFactory: (market as any).isFactory || false,
      symbol: (market as any).symbol || null,
      asset: (market as any).asset || null,
      period: (market as any).period || null,
      // 🔥 核心修复：保留 Polymarket 爬取的原始字段
      originalImage: (market as any).image || null,
      scrapedImage: (market as any).image || null,
      polyOdds: (market as any).outcomePrices || null,
      sourceUrl: (market as any).externalId ? `https://polymarket.com/event/${(market as any).externalId}` : null,
      description: market.description || '', // 保留原始描述
    };
  };

  // 格式化交易量
  const formatVolume = (volume: number | undefined | null): string => {
    if (volume === undefined || volume === null || isNaN(volume)) {
      return "$0.00";
    }

    const volumeNum = Number(volume);
    if (isNaN(volumeNum) || volumeNum < 0) {
      return "$0.00";
    }

    if (volumeNum >= 1000000) {
      return `$${(volumeNum / 1000000).toFixed(1)}m`;
    } else if (volumeNum >= 1000) {
      return `$${(volumeNum / 1000).toFixed(1)}k`;
    }
    return `$${volumeNum.toLocaleString()}`;
  };

  // 🔥 恢复数据库子分类设计：所有过滤都通过 categorySlug 匹配
  const filteredEvents = useMemo(() => {
    // 🔥 防御性检查：如果 marketData 为空，直接返回空数组
    if (!marketData || marketData.length === 0) {
      return [];
    }

    // 🔥 如果选的是 'all'，返回全部数据（API 已经按父分类过滤了）
    if (activeFilter === 'all') {
      return marketData.map(convertMarketToEvent);
    }

    // 🔥 分类过滤逻辑：通过 categorySlug 或 category 匹配子分类
    const filteredMarkets = marketData.filter((market: any) => {
      return market.categorySlug === activeFilter || market.category === activeFilter;
    });

    return filteredMarkets.map(convertMarketToEvent);
  }, [marketData, activeFilter, convertMarketToEvent]);


  // STEP 3: 逐个恢复 UI 组件 - 测试 1: 基础布局
  return (
    <>
      <div className="flex-1 w-full lg:max-w-[1600px] lg:mx-auto">
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="px-4 md:px-6 py-6 border-b border-border-dark">
            {/* 🔥 物理删除父级分类名称标题，直接显示子分类切换 Tab */}
            {/* 子分类标签栏 - 显示当前分类的子分类（从数据库读取） */}
            <SubCategoryTabs 
              slug={slug} 
              onFilterChange={setActiveFilter} 
              activeFilter={activeFilter}
              onHasSubCategoriesChange={setHasSubCategories}
            />
          </div>

          <div className="px-4 md:px-6 py-6">
            {/* 主体内容区域 - 已移除左侧侧边栏 */}
            <div className="flex flex-col gap-6">
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-text-secondary" suppressHydrationWarning>
                    {mounted ? t('category.loading') : 'Loading markets...'}
                  </span>
                </div>
              )}

              {error && !isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <p className="text-red-500 font-medium mb-2">{t('category.error')}</p>
                    <p className="text-text-secondary text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* 市场列表展示 */}
              {!isLoading && !error && (
                <>
                  {filteredEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredEvents.map((event) => {
                        // 🔥 物理确保 Key 唯一化：使用 originalId 或 id 作为 React key
                        // 目的：确保手动市场的 UUID 作为唯一 Key，防止被 React 的虚拟 DOM 过滤掉
                        const uniqueKey = event.originalId || event.id;
                        return (
                          <MarketCard key={uniqueKey} event={event} />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="text-6xl mb-4">📭</div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {t('category.empty.title')}
                      </h3>
                      <p className="text-text-secondary text-sm mb-6">
                        {t('category.empty.description', { category: translatedCategoryName })}
                      </p>
                      <div className="flex gap-3">
                        <a
                          href="/data"
                          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-lg font-medium transition-colors text-sm"
                        >
                          {t('category.empty.view_data')}
                        </a>
                        <a
                          href="/category/hot"
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-colors text-sm"
                        >
                          {t('category.empty.browse_hot')}
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
