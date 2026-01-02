"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineChart, TrendingUp, Users, DollarSign, Activity, BarChart, LucideIcon, Globe, Shield, Zap, Trophy } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface HotMarket {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  icon: string;
  yesPercent: number;
  noPercent: number;
  volume: number;
  closingDate: string;
  status: string;
  isHot: boolean;
  rank?: number | null;
}

interface Stats {
  volume24h: number;
  totalPositions: number;
  totalTVL: number;
  activeTraders24h: number;
  openMarketsCount: number;
}

interface GlobalStat {
  id: string;
  label: string;
  value: number;
  unit: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

// 🔥 移除 props 依赖，组件完全自主获取数据

// 合并的图标映射：Lucide 图标组件 + 字符串图标（emoji）
const iconMap: Record<string, LucideIcon | string> = {
  // Lucide 图标组件（用于全局指标）
  DollarSign,
  Activity,
  TrendingUp,
  Users,
  BarChart,
  LineChart,
  // 字符串图标（用于热门市场列表）
  Bitcoin: "₿",
  Building2: "🏛️",
  Trophy: "🏆",
  Cpu: "💻",
  Film: "🎬",
  Globe: "🌍",
  Coins: "🪙",
  Mic: "🎤",
  Default: "📈",
};

// 🔥 已移除所有 Mock 数据引用，确保生产环境不会显示旧数据

export function DataClient() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [globalStats, setGlobalStats] = useState<GlobalStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // 🔥 API 已经返回翻译后的 label，不需要再次翻译
  
  // 🔥 核心修复：初始数据为 null (不要用 []，以便区分"加载中"和"无数据")
  const [markets, setMarkets] = useState<HotMarket[] | null>(null);

  /**
   * 🔥 强制从 API 获取最新数据
   */
  const fetchHotMarkets = async (): Promise<HotMarket[]> => {
    // 强制加上时间戳，绕过所有缓存
    const timestamp = new Date().getTime();
    const response = await fetch(`/api/markets?page=1&pageSize=100&status=OPEN&t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data || !Array.isArray(result.data)) {
      throw new Error('Invalid response format');
    }

    // 转换为 HotMarket 格式
    const markets: HotMarket[] = result.data
      .filter((m: any) => m.status === 'OPEN' && (m.isActive !== false))
      .sort((a: any, b: any) => {
        const volumeA = Number(a.totalVolume || a.volume || 0);
        const volumeB = Number(b.totalVolume || b.volume || 0);
        return volumeB - volumeA;
      })
      .slice(0, 10)
      .map((market: any, index: number) => {
        let yesPercent = 50;
        let noPercent = 50;
        
        if (market.yesPercent !== undefined && market.noPercent !== undefined) {
          yesPercent = market.yesPercent;
          noPercent = market.noPercent;
        } else if (market.totalYes && market.totalNo) {
          const total = Number(market.totalYes) + Number(market.totalNo);
          yesPercent = Math.round((Number(market.totalYes) / total) * 100);
          noPercent = 100 - yesPercent;
        }
        
        return {
          id: market.id,
          title: market.titleZh || market.title || '未命名事件',
          description: market.descriptionZh || market.description || '',
          category: market.category || '未分类',
          categorySlug: market.categorySlug || 'all',
          icon: market.categories?.[0]?.category?.icon || market.icon || 'Bitcoin',
          yesPercent,
          noPercent,
          volume: Number(market.totalVolume || market.volume || 0),
          rank: market.rank !== null && market.rank !== undefined ? market.rank : index + 1,
          // 🔥 安全日期处理：确保 closingDate 始终是有效的日期字符串
          closingDate: (market.closingDate && typeof market.closingDate === 'string' && market.closingDate.trim() !== '')
            ? market.closingDate
            : (market.endTime && typeof market.endTime === 'string' && market.endTime.trim() !== '')
            ? market.endTime
            : new Date().toISOString(), // 兜底：使用当前时间
          status: market.status || 'OPEN',
          isHot: market.isHot || false,
        };
      });
    
    return markets;
  };

  /**
   * 🔥 核心逻辑：组件挂载后立即抓取最新数据
   */
  useEffect(() => {
    const init = async () => {
      try {
        // 加上时间戳，防止浏览器缓存 API 请求
        const data = await fetchHotMarkets();
        setMarkets(data);
      } catch (e) {
        console.error('❌ [DataClient] 获取最新数据失败:', e);
        setMarkets([]); // 失败则显示空状态
      }
    };
    init();
  }, []);

  // 获取全局指标
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        setIsLoadingStats(true);
        // 🔥 传递语言参数给 API
        const response = await fetch(`/api/stats?lang=${language}`, {
          cache: 'no-store',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setGlobalStats(data.data);
          } else {
            setGlobalStats([]);
          }
        } else {
          console.error("获取全局指标失败:", response.status, response.statusText);
          setGlobalStats([]);
        }
      } catch (error) {
        console.error("获取全局指标失败:", error);
        setGlobalStats([]);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchGlobalStats();
  }, [language]); // 🔥 语言切换时重新获取数据

  // 🔥 核心：如果 markets 为 null，强制显示骨架屏 (Skeleton)
  // 这确保了在数据回来之前，用户看到的是占位符，而不是旧数据
  if (markets === null) {
    return (
      <>
        {/* Hero Section Skeleton */}
        <section className="relative flex flex-col md:flex-row justify-between items-end gap-6 mb-3 pb-2 border-b border-border-dark">
          <div className="flex flex-col gap-4 max-w-[720px] relative z-10">
            <div className="h-12 bg-gray-100/10 animate-pulse rounded-lg w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-100/10 animate-pulse rounded-lg w-full mb-2"></div>
            <div className="h-6 bg-gray-100/10 animate-pulse rounded-lg w-2/3"></div>
            <div className="flex gap-4 mt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-24 bg-gray-100/10 animate-pulse rounded-full"></div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
          {/* 左侧：热门市场列表骨架 */}
          <div className="lg:col-span-8">
            <div className="bg-surface-dark rounded-lg border border-border-dark p-6">
              <div className="h-8 bg-gray-100/10 animate-pulse rounded-lg w-48 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-full h-24 bg-gray-100/10 animate-pulse rounded-lg border border-gray-800"></div>
                ))}
              </div>
              <div className="text-center text-sm text-text-secondary mt-4">
                {t('home.market_list.loading_markets')}
              </div>
            </div>
          </div>

          {/* 右侧：实时数据侧边栏骨架 */}
          <div className="lg:col-span-2">
            <div className="bg-surface-dark rounded-lg border border-border-dark p-6 sticky top-24 max-w-[280px]">
              <div className="h-8 bg-gray-100/10 animate-pulse rounded-lg w-32 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <div className="h-16 bg-gray-100/10 animate-pulse rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // 🔥 渲染真实数据
  const displayMarkets = markets;
  const isRealDataEmpty = displayMarkets.length === 0;
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      // 显示为整数，如 $42M
      const millions = Math.round(num / 1000000);
      return `${millions}M`;
    }
    if (num >= 1000) {
      // 显示为整数，如 $285K
      const thousands = Math.round(num / 1000);
      return `${thousands}K`;
    }
    return Math.round(num).toLocaleString();
  };

  // 获取实时数据卡片的图标颜色和样式
  const getStatCardStyle = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('交易量') || lowerLabel.includes('24h')) {
      return {
        iconColor: 'text-green-400',
        iconBg: 'bg-green-400/20',
        iconGlow: 'shadow-green-400/20',
      };
    } else if (lowerLabel.includes('持仓') || lowerLabel.includes('tvl') || lowerLabel.includes('锁仓')) {
      return {
        iconColor: 'text-cyan-400',
        iconBg: 'bg-cyan-400/20',
        iconGlow: 'shadow-cyan-400/20',
      };
    } else if (lowerLabel.includes('活跃') || lowerLabel.includes('交易者') || lowerLabel.includes('用户')) {
      return {
        iconColor: 'text-purple-400',
        iconBg: 'bg-purple-400/20',
        iconGlow: 'shadow-purple-400/20',
      };
    } else {
      return {
        iconColor: 'text-primary',
        iconBg: 'bg-primary/20',
        iconGlow: 'shadow-primary/20',
      };
    }
  };

  // 🔥 安全日期格式化：防止 Invalid time value 错误
  const formatDate = (dateString: string | null | undefined) => {
    // 空值检查
    if (!dateString) {
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      
      // 检查是否为无效日期 (Invalid Date)
      if (isNaN(date.getTime())) {
        console.warn('⚠️ [DataClient] 无效日期:', dateString);
        return 'N/A';
      }
      
      const now = new Date();
      const diff = date.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        return t('home.status.days_later').replace('{days}', days.toString());
      } else if (hours > 0) {
        return t('home.status.hours_later').replace('{hours}', hours.toString());
      } else {
        return t('home.status.ending_soon');
      }
    } catch (e) {
      console.error('❌ [DataClient] 日期格式化错误:', e, '原始值:', dateString);
      return 'N/A';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="layout-container flex h-full grow flex-col w-full lg:max-w-[1440px] lg:mx-auto px-4 lg:px-10 py-8">
        {/* Hero Section - 深色半透明背景 */}
        <section className="relative flex flex-col md:flex-row justify-between items-end gap-6 mb-3 pb-2 border-b border-border-dark">
          {/* 深色半透明背景 */}
          <div className="absolute inset-0 -mx-4 lg:-mx-10 -mt-8 bg-gradient-to-b from-surface-dark/50 to-transparent rounded-lg -z-10" />
          
          <div className="flex flex-col gap-4 max-w-[720px] relative z-10">
            <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
              <span className="text-primary">{t('home.hero.title_prefix')}</span>，{t('home.hero.title_suffix')}
            </h1>
            <p className="text-text-secondary text-lg font-normal leading-normal max-w-[600px]">
              {t('home.hero.subtitle')}
            </p>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/40 transition-colors whitespace-nowrap">
                <Globe className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                {t('home.hero.feature_global')}
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/40 transition-colors whitespace-nowrap">
                <TrendingUp className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                {t('home.hero.feature_odds')}
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/40 transition-colors whitespace-nowrap">
                <Shield className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                {t('home.hero.feature_security')}
              </div>
            </div>
          </div>
        </section>

        {/* 主要内容区域 - 80/20 分栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
          {/* 左侧：全网热门事件 Top 10 - 80% 宽度 */}
          <div className="lg:col-span-8">
            <div className="bg-surface-dark rounded-lg border border-border-dark p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {t('home.market_list.title')}
              </h2>


              {/* 紧凑表格布局 */}
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full border-collapse">
                  {/* 表头 - 精美的表头设计 */}
                  <thead>
                    <tr className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                      <th className="px-3 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider w-16">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-primary" />
                          <span>{t('home.market_list.rank')}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 pl-8 text-left text-xs font-bold text-primary uppercase tracking-wider min-w-[120px] md:min-w-[280px]">
                        {t('home.market_list.event')}
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider min-w-[120px] md:min-w-[200px]">
                        {t('home.market_list.prediction_probability')}
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider w-24">
                        {t('home.market_list.deadline')}
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider w-32">
                        {t('home.market_list.volume')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark">
                    {displayMarkets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-text-secondary">
                          {t('home.market_list.no_data')}
                        </td>
                      </tr>
                    ) : (
                      displayMarkets.map((market, index) => {
                      // 使用 rank（如果存在）或 index + 1 作为排名
                      const rankNumber = market.rank !== null && market.rank !== undefined ? market.rank : index + 1;
                      
                      // 获取图标
                      const iconValue = iconMap[market.icon];
                      const iconDisplay = typeof iconValue === 'string' ? iconValue : (typeof iconMap.Default === 'string' ? iconMap.Default : '📈');
                      
                      return (
                        <tr
                          key={market.id}
                          className="hover:bg-surface-dark/30 transition-colors cursor-pointer"
                          onClick={() => {
                            // 跳转到本平台的市场详情页
                            router.push(`/markets/${market.id}`);
                          }}
                        >
                          {/* 排名 - 带奖杯图标的精美设计 */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {/* 前三名显示特殊颜色和奖杯 */}
                              {rankNumber <= 3 ? (
                                <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                                  rankNumber === 1 
                                    ? 'bg-gradient-to-br from-yellow-400/30 to-yellow-600/30 text-yellow-400 border border-yellow-400/50 shadow-lg shadow-yellow-400/20' 
                                    : rankNumber === 2
                                    ? 'bg-gradient-to-br from-gray-300/30 to-gray-500/30 text-gray-300 border border-gray-300/50 shadow-lg shadow-gray-300/20'
                                    : 'bg-gradient-to-br from-orange-400/30 to-orange-600/30 text-orange-400 border border-orange-400/50 shadow-lg shadow-orange-400/20'
                                }`}>
                                  <Trophy className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs">
                                  {rankNumber}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 事件（含图标）- 可点击 */}
                          <td className="px-3 py-2.5 pl-8">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base flex-shrink-0 leading-none">{iconDisplay}</span>
                              <h3 className="font-bold text-white text-sm leading-tight truncate hover:text-primary transition-colors">
                                {market.title}
                              </h3>
                            </div>
                          </td>

                          {/* 预测概率（YES/NO 横向进度条） */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-[180px]">
                              <div className="flex-1 h-1.5 bg-pm-bg rounded-full overflow-hidden flex min-w-0">
                                <div
                                  className="bg-pm-green"
                                  style={{ width: `${market.yesPercent}%` }}
                                />
                                <div
                                  className="bg-red-500"
                                  style={{ width: `${market.noPercent}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 text-xs font-medium">
                                <span className="text-pm-green">{market.yesPercent}%</span>
                                <span className="text-text-secondary">/</span>
                                <span className="text-red-400">{market.noPercent}%</span>
                              </div>
                            </div>
                          </td>

                          {/* 截止日期 */}
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-text-secondary whitespace-nowrap">
                              {formatDate(market.closingDate)}
                            </div>
                          </td>

                          {/* 交易量 - 亮蓝色加粗，右对齐 */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="text-sm font-bold text-blue-400 whitespace-nowrap">
                              ${formatNumber(market.volume)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 右侧：预测市场实时数据 - 20% 宽度（最大280px） */}
          <div className="lg:col-span-2">
            <div className="bg-surface-dark rounded-lg border border-border-dark p-6 sticky top-24 max-w-[280px]">
              <h2 className="text-xl font-bold text-white mb-6">
                {t('home.sidebar.title')}
              </h2>

              <div className="space-y-4">
                {isLoadingStats ? (
                  <div className="text-center py-8 text-zinc-400">
                    {t('home.sidebar.loading')}
                  </div>
                ) : (globalStats.length === 0 ? (
                  // 🔥 移除硬编码占位符数据，显示空状态
                  <div className="text-center py-8 text-zinc-400 text-sm">
                    {t('home.sidebar.no_data')}
                  </div>
                ) : (
                  globalStats.map((stat) => {
                    // 获取图标：如果是 Lucide 组件则使用组件，否则使用默认组件
                    const iconValue = stat.icon ? iconMap[stat.icon] : null;
                    const IconComponent = 
                      iconValue && typeof iconValue !== 'string' 
                        ? (iconValue as LucideIcon)
                        : LineChart;
                    
                    // 根据标签获取样式（使用原始 label 判断样式，因为 API 返回的 label 已经是翻译后的）
                    // 注意：API 返回的 label 已经是翻译后的，但我们需要用原始 label 来判断样式
                    // 所以这里仍然使用 stat.label（API 返回的翻译后的 label）
                    const cardStyle = getStatCardStyle(stat.label);
                    
                    // 格式化显示值（根据标签判断是否需要$符号）
                    // 去掉所有数值后面的 'USD' 字符串，仅保留前置的 '$' 符号
                    const labelLower = stat.label.toLowerCase();
                    const needsDollar = labelLower.includes('volume') || labelLower.includes('tvl') || labelLower.includes('trading') || labelLower.includes('交易量') || labelLower.includes('持仓') || labelLower.includes('锁仓');
                    const formattedNumber = formatNumber(stat.value);
                    // 如果 unit 是 'USD'，则不显示，否则显示 unit
                    const unitToShow = stat.unit && stat.unit.toUpperCase() !== 'USD' ? stat.unit : '';
                    const displayValue = unitToShow
                      ? `${needsDollar ? '$' : ''}${formattedNumber} ${unitToShow}`
                      : `${needsDollar ? '$' : ''}${formattedNumber}`;
                    
                    return (
                      <div
                        key={`${stat.id}-${language}`}
                        className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 backdrop-blur-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${cardStyle.iconBg} flex items-center justify-center flex-shrink-0 shadow-lg ${cardStyle.iconGlow}`}>
                            <IconComponent className={`w-5 h-5 ${cardStyle.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                            <div className="text-2xl font-black text-white leading-none">
                              {displayValue}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
