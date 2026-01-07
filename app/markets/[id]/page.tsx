'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import dayjs from '@/lib/dayjs';
import MarketHeader from '@/components/market-detail/MarketHeader';
import PriceChart from '@/components/market-detail/PriceChart';
import TimeNavigationBar from '@/components/market-detail/TimeNavigationBar';
import OrderBook from '@/components/market-detail/OrderBook';
import TradeSidebar, { TradeSidebarRef } from '@/components/market-detail/TradeSidebar';
import UserPositionCard from '@/components/market-detail/UserPositionCard';
import { Market } from '@/types/api';
import { useAuth } from '@/components/providers/AuthProvider';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Market not found");
    }
    throw new Error("Failed to fetch market");
  }
  const result = await response.json();
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error("Invalid response format");
};

export default function MarketDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const tradeSidebarRef = useRef<TradeSidebarRef>(null);
  const { isLoggedIn, currentUser } = useAuth();
  
  // 1. 彻底消灭白屏报错（水合保护）
  const [isMounted, setIsMounted] = useState(false);
  const landingDone = useRef(false);
  
  // 交易金额状态管理
  const [amount, setAmount] = useState("");
  const handleAmountChange = (val: string) => {
    setAmount(val);
  };

  // 🔥 修复：添加交易 Tab 状态管理
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const handleTabChange = (tab: "buy" | "sell") => {
    setActiveTab(tab);
  };

  // 🔥 修复：添加详情标签页状态管理（订单簿/评论/持仓者/规则）
  const [detailTab, setDetailTab] = useState<"orderbook" | "comments" | "holders" | "rules">("orderbook");
  const handleDetailTabChange = (tab: "orderbook" | "comments" | "holders" | "rules") => {
    setDetailTab(tab);
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🔥 获取 SWR mutate 函数用于手动刷新数据
  const { mutate: mutateSWR } = useSWRConfig();
  
  // 🔥 实时同步：对于工厂市场，每5秒自动刷新赔率数据（确保与 Polymarket 实时同步）
  const { data: marketData, isLoading, error, mutate: mutateMarket } = useSWR<Market>(
    id ? `/api/markets/${id}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        // 🔥 性能优化：页面不可见时暂停轮询
        if (typeof document !== 'undefined' && document.hidden) {
          return 0; // 页面不可见时暂停
        }
        
        // 🔥 如果是工厂市场，无论是否有externalId，都每5秒刷新一次（实时同步赔率）
        // 这样即使暂时没有externalId，一旦匹配到就能立即显示
        if (data && (data as any).isFactory) {
          return 5000; // 5秒
        }
        // 其他市场每30秒刷新一次
        return 30000; // 30秒
      },
      revalidateOnFocus: false, // 🔥 性能优化：窗口聚焦时不自动重新验证（减少请求）
      revalidateOnReconnect: true, // 网络重连时重新验证
    }
  );

  // 🔥 核心修复：从独立的 positions API 获取用户持仓数据
  const { data: positionsData, mutate: mutatePositions } = useSWR(
    isLoggedIn && currentUser?.id && id ? `/api/positions?marketId=${id}&type=active` : null,
    async (url: string) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      const result = await response.json();
      return result.success ? result.data : [];
    },
    {
      refreshInterval: 0, // 不需要自动轮询，依靠交易成功后手动刷新
      revalidateOnFocus: true,
    }
  );

  // 🔍 添加日志验证

  // 🔥 关键修复：所有 hooks 必须在早期返回之前调用
  // 计算显示价格和百分比（使用安全默认值）
  const displayYesPercent = useMemo(() => {
    if (!marketData) return 50;
    if (marketData.status === "RESOLVED") {
      return marketData.winningOutcome === "YES" ? 100 : 0;
    }
    
    // 优先使用 API 返回的 yesPercent（API 已经解析了 outcomePrices）
    if (marketData.yesPercent && marketData.yesPercent !== 50) {
      return marketData.yesPercent;
    }
    
    // 兜底逻辑：如果 API 返回的 yesPercent 是默认值 50，但 outcomePrices 存在，尝试在前端解析
    const outcomePrices = (marketData as any).outcomePrices;
    if (outcomePrices) {
      try {
        const parsed = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
        
        let yesPrice: number | null = null;
        
        // 支持数组格式：[0.7, 0.3]
        if (Array.isArray(parsed) && parsed.length > 0) {
          yesPrice = parseFloat(String(parsed[0]));
        }
        // 支持对象格式：{ YES: 0.7, NO: 0.3 }
        else if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          if ('YES' in parsed) {
            yesPrice = parseFloat(String(parsed.YES));
          } else if ('yes' in parsed) {
            yesPrice = parseFloat(String(parsed.yes));
          }
        }
        
        if (yesPrice !== null && !isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
          return yesPrice * 100;
        }
      } catch (e) {
        console.warn('⚠️ [Market Detail Page] 解析 outcomePrices 失败:', e);
      }
    }
    
    return marketData.yesPercent || 50;
  }, [marketData]);

  const displayNoPercent = useMemo(() => {
    if (!marketData) return 50;
    if (marketData.status === "RESOLVED") {
      return marketData.winningOutcome === "NO" ? 100 : 0;
    }
    
    // 优先使用 API 返回的 noPercent
    if (marketData.noPercent && marketData.noPercent !== 50) {
      return marketData.noPercent;
    }
    
    // 兜底逻辑：如果 API 返回的 noPercent 是默认值 50，但 outcomePrices 存在，尝试在前端解析
    const outcomePrices = (marketData as any).outcomePrices;
    if (outcomePrices) {
      try {
        const parsed = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
        
        let noPrice: number | null = null;
        
        // 支持数组格式：[0.7, 0.3]
        if (Array.isArray(parsed) && parsed.length >= 2) {
          noPrice = parseFloat(String(parsed[1]));
        }
        // 支持对象格式：{ YES: 0.7, NO: 0.3 }
        else if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          if ('NO' in parsed) {
            noPrice = parseFloat(String(parsed.NO));
          } else if ('no' in parsed) {
            noPrice = parseFloat(String(parsed.no));
          }
        }
        
        if (noPrice !== null && !isNaN(noPrice) && noPrice >= 0 && noPrice <= 1) {
          return noPrice * 100;
        }
      } catch (e) {
        console.warn('⚠️ [Market Detail Page] 解析 outcomePrices 失败:', e);
      }
    }
    
    return 100 - displayYesPercent;
  }, [marketData, displayYesPercent]);

  // 🔥 核心修复：计算用户持仓数据（从 positions API 获取）
  const userPositionData = useMemo(() => {
    // 🔍 添加原始数据调试日志

    // 必须等待 positionsData 加载完成
    if (!positionsData || !Array.isArray(positionsData) || positionsData.length === 0) {

      return null;
    }
    
    // 过滤出当前市场的持仓（API 已经过滤了，但为了安全再检查一次）
    const marketPositions = positionsData.filter((pos: any) => pos.marketId === id);
    
    if (marketPositions.length === 0) {

      return null;
    }
    
    // 分离 YES 和 NO 持仓
    const yesPosition = marketPositions.find((pos: any) => pos.outcome === 'YES');
    const noPosition = marketPositions.find((pos: any) => pos.outcome === 'NO');
    
    // 判断用户是否有持仓
    const hasYesPosition = yesPosition && yesPosition.shares > 0;
    const hasNoPosition = noPosition && noPosition.shares > 0;

    if (!hasYesPosition && !hasNoPosition) {

      return null;
    }
    
    // 优先显示份额较多的持仓，如果都有持仓
    let mainPosition: {
      shares: number;
      avgPrice: number;
      currentPrice: number;
      outcome: "yes" | "no";
    } | null = null;
    
    if (hasYesPosition && hasNoPosition) {
      // 两个都有持仓，显示份额较多的
      if (yesPosition.shares >= noPosition.shares) {
        mainPosition = {
          shares: yesPosition.shares,
          avgPrice: yesPosition.avgPrice,
          currentPrice: displayYesPercent / 100,
          outcome: "yes",
        };
      } else {
        mainPosition = {
          shares: noPosition.shares,
          avgPrice: noPosition.avgPrice,
          currentPrice: displayNoPercent / 100,
          outcome: "no",
        };
      }
    } else if (hasYesPosition) {
      mainPosition = {
        shares: yesPosition.shares,
        avgPrice: yesPosition.avgPrice,
        currentPrice: displayYesPercent / 100,
        outcome: "yes",
      };
    } else if (hasNoPosition) {
      mainPosition = {
        shares: noPosition.shares,
        avgPrice: noPosition.avgPrice,
        currentPrice: displayNoPercent / 100,
        outcome: "no",
      };
    }

    return mainPosition;
  }, [positionsData, id, displayYesPercent, displayNoPercent]);

  // 生成图表数据（使用安全默认值）
  const priceData = useMemo(() => {
    const data = [];
    const now = Date.now();
    const hours = 24;
    const baseValue = marketData ? (marketData.yesPercent / 100 || 0.5) : 0.5;
    
    for (let i = hours; i >= 0; i--) {
      const time = new Date(now - i * 60 * 60 * 1000);
      const variation = (Math.sin(i / 3) * 0.1) + (Math.random() * 0.05);
      const value = Math.max(0.3, Math.min(0.9, baseValue + variation));
      
      data.push({
        time: time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        value: value,
        timestamp: time.getTime(),
      });
    }
    
    return data;
  }, [marketData]);

  // formatVolume 函数（纯函数，不依赖 hooks）
  const formatVolume = (volume?: number | string | null): string => {
    const { formatCurrency } = require('@/lib/utils');
    return formatCurrency(volume, { compact: true, decimals: 1, showDecimals: true });
  };

  // 创建 MarketEvent 对象（使用安全默认值）
  const marketEvent = useMemo(() => {
    if (!marketData) {
      return {
        id: 1,
        rank: 1,
        title: '',
        category: '加密货币',
        categorySlug: 'crypto',
        icon: 'Bitcoin',
        iconColor: 'bg-[#f7931a]',
        yesPercent: 50,
        noPercent: 50,
        deadline: new Date().toISOString().split("T")[0],
        volume: '$0',
      };
    }
    return {
      id: parseInt(marketData.id.replace(/-/g, '').substring(0, 10), 16) || 1,
      rank: 1,
      title: marketData.title,
      category: (marketData as any).category?.name || (marketData as any).category || '加密货币',
      categorySlug: (marketData as any).category?.slug || 'crypto',
      icon: (marketData as any).icon || undefined, // 🔥 修复：不默认使用Bitcoin，让MarketHeader根据数据动态判断
      iconColor: (marketData as any).iconColor || undefined,
      yesPercent: displayYesPercent,
      noPercent: displayNoPercent,
      deadline: new Date(marketData.endTime).toISOString().split("T")[0],
      volume: formatVolume((marketData as any).totalVolume || 0),
    };
  }, [marketData, displayYesPercent, displayNoPercent]);

  // 🔥 移除自动跳转逻辑：允许用户自由选择查看未来场次和已结束场次
  // 之前的自动跳转逻辑会强制跳回当前进行中的场次，阻止用户查看其他场次
  // 现在改为仅在首次从外部链接进入时（没有 landingDone 标记）才自动跳转到活跃场次
  // 一旦用户手动选择了场次，就不再自动跳转
  useEffect(() => {
    // 如果已经手动选择过场次，不再自动跳转
    if (!isMounted || !(marketData as any)?.slots?.length || landingDone.current) return;
    
    // 检查是否是从外部链接直接进入的（URL 中的 id 不在 slots 列表中）
    const isExternalLink = !(marketData as any).slots.some((s: any) => s.id === id);
    
    // 只有从外部链接进入时，才自动跳转到活跃场次
    if (isExternalLink) {
      const activeSlot = (marketData as any).slots.find((s: any) => 
        dayjs.utc().isBetween(dayjs.utc(s.startTime), dayjs.utc(s.endTime))
      );
      
      if (activeSlot && id !== activeSlot.id) {
        landingDone.current = true;
        router.replace(`/markets/${activeSlot.id}`);
      }
    }
  }, [isMounted, marketData, id, router]);

  // 物理解决水合报错
  if (!isMounted) {
    return <div className="min-h-screen bg-black" />;
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center py-20 text-white">加载中...</div>
        </div>
      </main>
    );
  }

  if (error || !marketData) {
    return (
      <main className="min-h-screen bg-black overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-4 text-white">市场未找到</h1>
            <p className="text-gray-400">{error?.message || "Market not found"}</p>
          </div>
        </div>
      </main>
    );
  }

  // 计算市场状态（在早期返回之后，但这是普通变量，不是 hooks）
  const marketStatus: "open" | "closed" = marketData.status === "OPEN" ? "open" : "closed";
  const marketResult: "yes" | "no" | null = marketData.status === "RESOLVED" 
    ? (marketData.winningOutcome === "YES" ? "yes" : "no")
    : null;

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* MarketHeader */}
        <MarketHeader
          event={marketEvent}
          status={marketStatus}
          result={marketResult === "yes" ? "YES_WON" : marketResult === "no" ? "NO_WON" : null}
          closingDate={marketData.endTime}
          period={(marketData as any)?.period || null}
          isFactory={!!(marketData as any)?.templateId}
          imageUrl={(marketData as any)?.imageUrl || (marketData as any)?.image || null}
        />

        {/* 2. 物理修复 Sticky 交易区（左动右不动） */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6 items-start">
          {/* 左侧区域 */}
          <div className="flex-1 lg:flex-[2] space-y-4 w-full">
            {/* K线图 */}
            <div className="w-full h-[320px] bg-[#0a0b0d] rounded-xl border border-gray-800 relative mb-8 z-0">
              <PriceChart
                yesPercent={displayYesPercent}
                marketStatus={marketStatus}
                marketResult={marketResult === "yes" ? "YES_WON" : marketResult === "no" ? "NO_WON" : null}
                slots={(marketData as any)?.slots || []}
                currentMarketId={marketData.id}
                period={(marketData as any)?.period || null}
                templateId={(marketData as any)?.templateId || (marketData as any)?.template?.id || null}
                height={320}
                data={priceData}
                hideNavigation={false}
                isFactory={!!((marketData as any)?.isFactory || (marketData as any)?.templateId)}
              />
            </div>

            {/* 场次导航 */}
            {(marketData as any)?.period && (
              <div className="py-2 border-b border-gray-800">
                <TimeNavigationBar
                  slots={(marketData as any)?.slots || []}
                  currentMarketId={marketData.id}
                  period={(marketData as any)?.period || null}
                  templateId={(marketData as any)?.templateId || (marketData as any)?.template?.id || null}
                />
              </div>
            )}

            {/* 我的持仓面板 */}
            {userPositionData && (
              <div className="mb-4 relative z-20">
                <UserPositionCard
                  position={userPositionData}
                  onSell={() => {
                    // 🔥 修复：点击卖出按钮时，切换到卖出标签、选择正确的 outcome、填充最大份额
                    handleTabChange("sell");
                    // 通过 ref 调用 switchToSell 并设置金额
                    if (tradeSidebarRef.current) {
                      tradeSidebarRef.current.switchToSell(userPositionData.outcome, userPositionData.shares);
                    }
                  }}
                  marketTitle={marketData.title}
                  marketStatus={marketData.status as "OPEN" | "RESOLVED"}
                  winningOutcome={marketData.winningOutcome}
                />
              </div>
            )}

            {/* 详情 Tabs */}
            <div className="mt-16">
              <OrderBook
                activeTab={detailTab}
                onTabChange={handleDetailTabChange}
                marketTitle={marketData.title}
                endDate={new Date(marketData.endTime).toISOString().split("T")[0]}
                userOrders={(marketData as any).userOrders || []}
                marketId={marketData.id}
                onPriceSelect={(price) => {
                  // 🔥 修复：点击订单簿价格时，填充到交易区并切换到限价模式
                  if (tradeSidebarRef.current) {
                    tradeSidebarRef.current.setLimitPriceAndSwitch(price);
                  }
                }}
              />
            </div>
          </div>

          {/* 右侧交易区：粘性固定 */}
          <div className="sticky top-4 h-fit z-10 w-full lg:w-auto">
            <TradeSidebar
              ref={tradeSidebarRef}
              yesPercent={displayYesPercent}
              noPercent={displayNoPercent}
              marketId={marketData.id}
              userPosition={(marketData as any)?.userPosition || null}
              marketTitle={marketData.title}
              marketStatus={marketData.status as "OPEN" | "RESOLVED"}
              winningOutcome={marketData.winningOutcome}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              amount={amount}
              onAmountChange={handleAmountChange}
              feeRate={(marketData as any).feeRate || 0.02}
              onTradeSuccess={async (data) => {
                // 🔥 交易成功后立即刷新市场数据，确保持仓面板更新

                if (id) {
                  const marketKey = `/api/markets/${id}`;
                  
                  // 1. 刷新市场基础数据 (赔率、总交易量、userPosition等)
                  // 匹配所有以 /api/markets/${id} 开头的 key（支持字符串和数组格式）

                  await mutateSWR((key) => {
                    const keyString = Array.isArray(key) ? key[0] : key;
                    return typeof keyString === 'string' && keyString.startsWith(marketKey);
                  }, undefined, { revalidate: true });
                  // 同时使用本地 mutateMarket 确保刷新
                  await mutateMarket(undefined, { revalidate: true });
                  
                  // 2. [关键修复] 刷新用户持仓数据（直接调用 positions hook 的 mutate）

                  await mutatePositions();

                  // 3. 刷新用户余额

                  await mutateSWR('/api/user/assets', undefined, { revalidate: true });
                  
                  // 4. 刷新用户订单数据（兼容 String Key 和 Array Key）
                  await mutateSWR((key) => {
                    // 如果 key 是字符串：检查是否包含 orders/user
                    if (typeof key === 'string') {
                      return key.includes('/api/orders/user');
                    }
                    // 如果 key 是数组：检查第一个元素是否是 API 路径
                    if (Array.isArray(key)) {
                      return key[0] === '/api/orders/user' || (typeof key[0] === 'string' && key[0].includes('/api/orders/user'));
                    }
                    return false;
                  }, undefined, { revalidate: true });
                  
                  // 5. 刷新用户详情数据（支持数组格式）
                  await mutateSWR((key) => {
                    const keyString = Array.isArray(key) ? key[0] : key;
                    return typeof keyString === 'string' && keyString.startsWith('/api/users/');
                  }, undefined, { revalidate: true });
                  
                  // 6. 同时使用 router.refresh() 作为备选刷新机制
                  router.refresh();

                }
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
