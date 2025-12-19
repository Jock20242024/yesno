"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineChart, TrendingUp, Users, DollarSign, Activity, BarChart, LucideIcon, Globe, Shield } from "lucide-react";

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

interface DataClientProps {
  hotMarkets: HotMarket[];
  stats?: Stats;
}

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

// Mock 数据（当没有真实数据时使用）
const mockHotMarkets: HotMarket[] = [
  {
    id: 'mock-1',
    title: 'BTC 价格将在 2025 年 1 月超过 $100,000',
    description: '',
    category: '加密货币',
    categorySlug: 'crypto',
    icon: 'Bitcoin',
    yesPercent: 68,
    noPercent: 32,
    volume: 42000000,
    closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 1,
  },
  {
    id: 'mock-2',
    title: '2025 年 AI 领域将出现新的突破性产品',
    description: '',
    category: '科技',
    categorySlug: 'technology',
    icon: 'Cpu',
    yesPercent: 45,
    noPercent: 55,
    volume: 28500000,
    closingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 2,
  },
  {
    id: 'mock-3',
    title: '下一届美国总统选举结果预测',
    description: '',
    category: '政治',
    categorySlug: 'politics',
    icon: 'Building2',
    yesPercent: 52,
    noPercent: 48,
    volume: 38000000,
    closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 3,
  },
  {
    id: 'mock-4',
    title: '2025 年 NBA 总冠军预测',
    description: '',
    category: '体育',
    categorySlug: 'sports',
    icon: 'Trophy',
    yesPercent: 38,
    noPercent: 62,
    volume: 19500000,
    closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 4,
  },
  {
    id: 'mock-5',
    title: '全球股市将在 2025 年 Q1 上涨 10%',
    description: '',
    category: '金融',
    categorySlug: 'finance',
    icon: 'DollarSign',
    yesPercent: 58,
    noPercent: 42,
    volume: 31500000,
    closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 5,
  },
];

export default function DataClient({ hotMarkets, stats }: DataClientProps) {
  const [globalStats, setGlobalStats] = useState<GlobalStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // 获取全局指标
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        setIsLoadingStats(true);
        const response = await fetch("/api/stats");
        const data = await response.json();
        
        if (data.success && data.data) {
          setGlobalStats(data.data);
        }
      } catch (error) {
        console.error("获取全局指标失败:", error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchGlobalStats();
  }, []);

  // 如果真实数据为空，使用 Mock 数据
  const displayMarkets = hotMarkets.length > 0 ? hotMarkets : mockHotMarkets;
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      // 显示为整数，如 $42M
      const millions = Math.round(num / 1000000);
      return `$${millions}M`;
    }
    if (num >= 1000) {
      // 显示为整数，如 $285K
      const thousands = Math.round(num / 1000);
      return `$${thousands}K`;
    }
    return `$${Math.round(num).toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} 天后`;
    } else if (hours > 0) {
      return `${hours} 小时后`;
    } else {
      return "即将截止";
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="layout-container flex h-full grow flex-col w-full lg:max-w-[1440px] lg:mx-auto px-4 lg:px-10 py-8">
        {/* Hero Section - 深色半透明背景 */}
        <section className="relative flex flex-col md:flex-row justify-between items-end gap-6 mb-10 pb-8 border-b border-border-dark">
          {/* 深色半透明背景 */}
          <div className="absolute inset-0 -mx-4 lg:-mx-10 -mt-8 bg-gradient-to-b from-surface-dark/50 to-transparent rounded-lg -z-10" />
          
          <div className="flex flex-col gap-4 max-w-[720px] relative z-10">
            <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
              <span className="text-primary">预测未来</span>，赢取丰厚奖励
            </h1>
            <p className="text-text-secondary text-lg font-normal leading-normal max-w-[600px]">
              加入全球预测市场。不仅是旁观者，更是参与者。交易您对世界大事的看法，在每一份不确定中发现价值。
            </p>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/40 transition-colors">
                <Globe className="w-[18px] h-[18px] text-primary" />
                全球热点
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/40 transition-colors">
                <TrendingUp className="w-[18px] h-[18px] text-primary" />
                实时赔率
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-dark hover:border-primary/40 transition-colors">
                <Shield className="w-[18px] h-[18px] text-primary" />
                安全透明
              </div>
            </div>
          </div>
        </section>

        {/* 主要内容区域 - 70/30 分栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
          {/* 左侧：全网热门事件 Top 10 - 70% 宽度 */}
          <div className="lg:col-span-7">
            <div className="bg-surface-dark rounded-lg border border-border-dark p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                全网热门事件 Top 10
              </h2>

              {/* 紧凑表格布局 */}
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full border-collapse">
                  {/* 表头 - 灰色文字 */}
                  <thead>
                    <tr className="border-b border-border-dark">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-16">
                        排名
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider min-w-[240px]">
                        事件
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider min-w-[200px]">
                        预测概率
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-32">
                        截止日期
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-28">
                        交易量
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark">
                    {displayMarkets.map((market, index) => {
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
                          {/* 排名 - 紧凑圆形 */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs">
                              {rankNumber}
                            </div>
                          </td>

                          {/* 事件（含图标）- 可点击 */}
                          <td className="px-3 py-2.5">
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

                          {/* 交易量 - 蓝色加粗 */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="text-sm font-bold text-primary whitespace-nowrap">
                              {formatNumber(market.volume)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 右侧：预测市场实时数据 - 30% 宽度 */}
          <div className="lg:col-span-3">
            <div className="bg-surface-dark rounded-lg border border-border-dark p-6 sticky top-24">
              <h2 className="text-xl font-bold text-white mb-6">
                实时数据
              </h2>

              <div className="space-y-4">
                {isLoadingStats ? (
                  <div className="text-center py-8 text-zinc-400">
                    加载中...
                  </div>
                ) : (globalStats.length === 0 ? (
                  // 默认占位符数据（当 GlobalStat 表中没有数据时显示）
                  <>
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary mb-1">24H 交易量</div>
                          <div className="text-xl font-bold text-white">$142.5M</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary mb-1">全网持仓量</div>
                          <div className="text-xl font-bold text-white">$892.3M</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <BarChart className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary mb-1">总锁仓量 (TVL)</div>
                          <div className="text-xl font-bold text-white">$1.24B</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary mb-1">24H 活跃交易者</div>
                          <div className="text-xl font-bold text-white">12,548</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-secondary mb-1">进行中事件</div>
                          <div className="text-xl font-bold text-white">1,247</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  globalStats.map((stat) => {
                    // 获取图标：如果是 Lucide 组件则使用组件，否则使用默认组件
                    const iconValue = stat.icon ? iconMap[stat.icon] : null;
                    const IconComponent = 
                      iconValue && typeof iconValue !== 'string' 
                        ? (iconValue as LucideIcon)
                        : LineChart;
                    
                    const displayValue = stat.unit 
                      ? `${formatNumber(stat.value)} ${stat.unit}`
                      : formatNumber(stat.value);
                    
                    return (
                      <div
                        key={stat.id}
                        className="bg-surface-dark border border-border-dark rounded-lg p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-text-secondary mb-1">{stat.label}</div>
                            <div className="text-xl font-bold text-white">
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
