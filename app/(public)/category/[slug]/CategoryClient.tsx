'use client';

import { useState, useEffect, useMemo } from "react";
import { Market } from "@/types/api";
import { MarketEvent } from "@/lib/data";
import MarketCard from "@/components/MarketCard";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import SubCategoryTabs from "./SubCategoryTabs";

interface CategoryClientProps {
  slug: string;
  categoryName: string;
  pageTitle: string;
  hasFilters: boolean;
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
  
  // activeFilter 用于子分类筛选："all" 表示显示全部，其他值表示子分类 slug
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [marketData, setMarketData] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取市场数据
  const fetchMarkets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      // 根据 activeFilter（子分类 slug）筛选
      if (slug === "hot" || slug === "trending") {
        params.append("category", "hot");
      } else {
        // 普通分类页面
        if (activeFilter !== "all" && activeFilter !== slug) {
          // 如果选择了子分类，使用子分类的 slug
          params.append("category", activeFilter);
        } else {
          // 如果选择"全部"，使用当前分类的 slug
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
      console.log('🔍 [CategoryClient] API 返回的原始数据:', {
        success: result.success,
        dataLength: result.data?.length || 0,
        data: result.data,
        url: `/api/markets?${params.toString()}`,
      });
      
      if (result.success && result.data) {
        let markets = result.data;
        
        // 🔥 物理调试：打印处理前的数据长度
        console.log('🔍 [CategoryClient] 处理前的 markets 长度:', markets.length);
        
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
      setError(err instanceof Error ? err.message : "Error fetching data.");
      console.error("Error fetching markets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, [slug, activeFilter]);

  // 将 Market 类型转换为 MarketEvent 类型
  const convertMarketToEvent = (market: Market): MarketEvent & { originalId?: string } => {
    const getSafeDeadline = (dateValue?: string | Date): string => {
      if (!dateValue) return "N/A";
      
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          console.warn('Invalid date value:', dateValue);
          return "N/A";
        }
        return date.toISOString().split("T")[0];
      } catch (error) {
        console.error('Error parsing date:', dateValue, error);
        return "N/A";
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

    return {
      id: numericId,
      rank: 1,
      title: market.title,
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

  // 🚀 第三步：统一前端统计与渲染逻辑
  // 物理要求：前端禁止再对 API 返回的数据做任何关于时间或状态的二次过滤
  // API 吐出多少，前端就画出多少
  const filteredEvents = useMemo(() => {
    // 🚀 物理重写：如果是"全部"标签，直接使用 marketData.length，不进行任何过滤
    // 确保 Tab 上显示的数字 (如：4) 必须物理等于下方渲染出的卡片数量
    return marketData.map(convertMarketToEvent);
  }, [marketData]);

  // 🔥 前端显示数量对齐检查：添加调试日志
  useEffect(() => {
    console.log('📊 [CategoryClient] 当前前端渲染的市场卡片总数:', filteredEvents.length);
    console.log('📊 [CategoryClient] 分类:', categoryName, '筛选:', activeFilter);
    console.log('📊 [CategoryClient] marketData 长度:', marketData.length);
    console.log('📊 [CategoryClient] filteredEvents 长度:', filteredEvents.length);
  }, [filteredEvents.length, categoryName, activeFilter, marketData.length]);

  // STEP 3: 逐个恢复 UI 组件 - 测试 1: 基础布局
  return (
    <>
      <div className="flex-1 w-full lg:max-w-[1600px] lg:mx-auto">
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="px-4 md:px-6 py-6 border-b border-border-dark">
            {/* 🔥 物理删除父级分类名称标题，直接显示子分类切换 Tab */}
            {/* 子分类标签栏 - 显示当前分类的子分类 */}
            <SubCategoryTabs slug={slug} onFilterChange={setActiveFilter} activeFilter={activeFilter} />
          </div>

          <div className="px-4 md:px-6 py-6">
            {/* 主体内容区域 - 已移除左侧侧边栏 */}
            <div className="flex flex-col gap-6">
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                  <span className="text-text-secondary">Loading Markets...</span>
                </div>
              )}

              {error && !isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <p className="text-red-500 font-medium mb-2">Error fetching data.</p>
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
                          <MarketCard key={uniqueKey} event={event} isLoggedIn={isLoggedIn} />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="text-6xl mb-4">📭</div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        暂无相关预测事件
                      </h3>
                      <p className="text-text-secondary text-sm mb-6">
                        {categoryName} 分类下暂时没有市场事件，去看看别的吧
                      </p>
                      <div className="flex gap-3">
                        <a
                          href="/data"
                          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-lg font-medium transition-colors text-sm"
                        >
                          查看数据中心
                        </a>
                        <a
                          href="/category/hot"
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-colors text-sm"
                        >
                          浏览热门市场
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
