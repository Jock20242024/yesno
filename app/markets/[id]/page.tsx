"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import TradeSidebar, { TradeSidebarRef } from "@/components/market-detail/TradeSidebar";
import UserPositionCard from "@/components/market-detail/UserPositionCard";
import { useStore } from "@/app/context/StoreContext";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotification } from "@/components/providers/NotificationProvider";
import { Market } from "@/types/api";
import { MarketEvent } from "@/lib/data";
import { formatUSD } from "@/lib/utils";

// 新的持仓接口：支持同时持有 YES 和 NO
interface UserPosition {
  yesShares: number;
  noShares: number;
  yesAvgPrice: number;
  noAvgPrice: number;
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  // 架构加固：Page 级组件允许使用 Context，但需要防御性处理
  const { positions: storePositions } = useStore();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { addNotification } = useNotification();
  
  // 移除 early return，确保初始 render 直接返回 UI
  
  // API 数据状态
  const [marketData, setMarketData] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 用户仓位状态（从 API 交易返回）
  // 注意：这个 state 用于存储从交易成功回调中返回的单个持仓（YES 或 NO）
  const [apiTradePosition, setApiTradePosition] = useState<{
    outcome: 'YES' | 'NO';
    shares: number;
    avgPrice: number;
    totalValue: number;
  } | null>(null);
  
  // UI 状态
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [detailTab, setDetailTab] = useState<"orderbook" | "comments" | "holders" | "rules">("orderbook");
  const [tradeAmount, setTradeAmount] = useState("");
  const tradeSidebarRef = useRef<TradeSidebarRef>(null);
  
  // 管理员结算状态
  const [isResolving, setIsResolving] = useState(false);
  const [showResolveOptions, setShowResolveOptions] = useState(false);
  
  // 检查是否为管理员（优先使用 role 字段）
  const isAdmin = currentUser?.role === "admin" || currentUser?.isAdmin || currentUser?.email === "admin@admin.com";

  // 获取市场数据
  const fetchMarket = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/markets/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Market not found");
        }
        throw new Error("Failed to fetch market");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setMarketData(result.data);
        
        // 修复详情页订单列表：从 API 获取用户持仓数据
        // 如果 API 返回了用户持仓数据，使用它；否则从 Store 获取
        if (result.data.userPosition) {
          // API 返回了用户持仓，使用它
          console.log('📊 [MarketDetailPage] 从 API 获取用户持仓:', result.data.userPosition);
        } else {
          // API 没有返回用户持仓，使用 Store 数据（向后兼容）
          console.log('📊 [MarketDetailPage] API 未返回用户持仓，使用 Store 数据');
        }
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching market data.");
      console.error("Error fetching market:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    if (id) {
      fetchMarket();
    }
  }, [id]);

  // 修复详情页订单列表：优先使用从 API 获取的用户持仓数据
  // 从 API 数据中获取用户持仓（如果可用）
  // 这是从市场详情 API 返回的完整持仓数据（包含 YES 和 NO）
  const apiUserPosition: UserPosition | null = marketData?.userPosition 
    ? {
        yesShares: marketData.userPosition.yesShares || 0,
        noShares: marketData.userPosition.noShares || 0,
        yesAvgPrice: marketData.userPosition.yesAvgPrice || 0,
        noAvgPrice: marketData.userPosition.noAvgPrice || 0,
      }
    : null;
  
  // 从 Store 实时查找当前市场的持仓（作为后备）
  const yesPosition = storePositions.find(p => p.marketId === id && p.outcome === 'YES');
  const noPosition = storePositions.find(p => p.marketId === id && p.outcome === 'NO');
  
  // 转换为 UserPosition 格式（Store 数据）
  const storeUserPosition: UserPosition | null = (yesPosition || noPosition) ? {
    yesShares: yesPosition?.shares || 0,
    noShares: noPosition?.shares || 0,
    yesAvgPrice: yesPosition?.avgPrice || 0,
    noAvgPrice: noPosition?.avgPrice || 0,
  } : null;
  
  // 优先使用 API 返回的持仓数据，如果没有则使用 Store 数据
  const userPosition: UserPosition | null = apiUserPosition || storeUserPosition;

  // 当用户手动切换 Tab 时（从 sell 切换到 buy），清空输入
  useEffect(() => {
    if (tradeTab === "buy") {
      setTradeAmount("");
    }
  }, [tradeTab]);

  // 格式化交易量（移到 return 之前，确保始终可用）

  // 格式化交易量
  // ========== 修复：格式化交易量，处理 undefined/null 值 ==========
  const formatVolume = (volume?: number | null): string => {
    // 安全检查：处理 undefined、null 或无效值
    if (volume === undefined || volume === null || isNaN(volume)) {
      return "$0.00"; // 返回安全的默认值
    }
    
    const volumeNum = Number(volume);
    if (isNaN(volumeNum) || volumeNum < 0) {
      return "$0.00";
    }
    
    // 格式化逻辑
    if (volumeNum >= 1000000) {
      return `$${(volumeNum / 1000000).toFixed(1)}M`;
    } else if (volumeNum >= 1000) {
      return `$${(volumeNum / 1000).toFixed(1)}K`;
    }
    return `$${volumeNum.toLocaleString()}`;
  };

  // 这些变量已在条件渲染块内计算，不再提前计算

  // 处理交易成功回调
  // 修复交易状态管理：下注成功后，刷新详情页订单列表，并根据用户持仓情况禁用或修改交易按钮状态
  const handleTradeSuccess = async (data: {
    updatedMarketPrice: { yesPercent: number; noPercent: number };
    userPosition: { outcome: 'YES' | 'NO'; shares: number; avgPrice: number; totalValue: number };
  }) => {
    // 更新市场价格
    setMarketData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        yesPercent: data.updatedMarketPrice.yesPercent,
        noPercent: data.updatedMarketPrice.noPercent,
      };
    });

    // 更新用户仓位（从交易成功回调）
    setApiTradePosition(data.userPosition);
    
    // 重新获取市场数据以同步最新的持仓信息
    // 这将确保 API 返回的用户持仓数据（如 {yesShares: 190, noShares: 0, yesAvgPrice: 1, noAvgPrice: 0}）正确显示
    await fetchMarket();
    
    // 修复交易状态管理：根据用户持仓情况，自动切换到卖出 Tab（如果有持仓）
    // 如果没有持仓，保持在买入 Tab
    if (data.userPosition.shares > 0) {
      // 有持仓时，可以切换到卖出 Tab（可选，根据 UX 需求）
      // setTradeTab("sell");
    }
  };

  const handleSell = () => {
    setTradeTab("sell");
    tradeSidebarRef.current?.switchToSell();
  };

  // 快速卖出：切换到卖出 Tab 并自动填充最大份额
  const handleQuickSell = (outcome: "yes" | "no") => {
    if (!userPosition) return;
    
    setTradeTab("sell");
    tradeSidebarRef.current?.switchToSell();
    const shares = outcome === "yes" ? userPosition.yesShares : userPosition.noShares;
    setTradeAmount(shares.toString());
  };

  // 处理市场结算
  const handleResolveMarket = async (resolutionOutcome: "YES" | "NO" | "Invalid") => {
    if (!marketData || isResolving) return;

    setIsResolving(true);
    setShowResolveOptions(false);

    try {
      // 添加管理员 Token 验证（从 localStorage 获取或使用预设 Token）
      const adminToken = localStorage.getItem('adminToken') || 'ADMIN_SECRET_TOKEN';
      const response = await fetch(`/api/admin/resolve/${marketData.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          resolutionOutcome,
        }),
      });

      const result = await response.json();

      if (result.success) {
        addNotification({
          type: "success",
          title: "市场已结算！",
          message: `结算结果: ${resolutionOutcome === "Invalid" ? "无效" : resolutionOutcome}`,
        });

        // 更新市场数据
        setMarketData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: "RESOLVED",
            winningOutcome: resolutionOutcome === "Invalid" ? null : resolutionOutcome,
            updatedAt: new Date().toISOString(),
          };
        });

        // 重新获取市场数据以确保同步
        await fetchMarket();
      } else {
        addNotification({
          type: "error",
          title: "结算失败",
          message: result.error || "请稍后重试",
        });
      }
    } catch (error) {
      console.error("Market resolution error:", error);
      addNotification({
        type: "error",
        title: "结算失败",
        message: "网络错误，请稍后重试",
      });
    } finally {
      setIsResolving(false);
    }
  };

  return (
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-8 flex flex-row gap-8">
      {/* 加载状态：显示空状态，不阻塞渲染 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 w-full">
          <Loader2 className="w-8 h-8 animate-spin text-pm-green mb-4" />
          <p className="text-white text-lg font-medium">Loading Market Details...</p>
        </div>
      )}

      {/* 错误状态：显示空状态，不阻塞渲染 */}
      {(error || !marketData) && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 w-full">
          <h1 className="text-2xl font-bold text-white mb-4">Market not found</h1>
          <p className="text-zinc-500 mb-6">
            {error || "The market you're looking for doesn't exist."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-pm-green hover:bg-green-400 text-pm-bg font-bold rounded-xl transition-colors"
          >
            返回首页
          </button>
        </div>
      )}

      {/* 正常内容：只在有数据且不在加载时显示 */}
      {!isLoading && marketData && (() => {
        // 创建 MarketEvent 对象用于 MarketHeader
        const marketEvent: MarketEvent = {
          id: parseInt(marketData.id),
          rank: 1,
          title: marketData.title,
          category: marketData.category,
          categorySlug: marketData.categorySlug,
          icon: "Bitcoin",
          iconColor: "bg-[#f7931a]",
          yesPercent: marketData.yesPercent,
          noPercent: marketData.noPercent,
          deadline: new Date(marketData.endTime).toISOString().split("T")[0],
          imageUrl: marketData.imageUrl,
          volume: formatVolume(marketData.volume),
          comments: marketData.commentsCount,
        };

        // 转换状态格式用于 MarketHeader
        const marketStatus = marketData.status === "OPEN" ? "open" : "closed";
        const marketResult = marketData.winningOutcome === "YES" ? "YES_WON" : 
                             marketData.winningOutcome === "NO" ? "NO_WON" : null;
        
        // 计算费率（默认 2%，已结束市场 1%）
        const feeRate = marketData.status === "RESOLVED" ? 0.01 : 0.02;

        return (
          <>
      <div className="flex-1 flex flex-col">
        {/* Market Header */}
        <MarketHeader 
          event={marketEvent} 
          status={marketStatus} 
          result={marketResult}
          closingDate={marketData.endTime}
        />

        {/* 管理员结算 UI */}
        {isAdmin && marketData.status === "OPEN" && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-amber-400">管理员操作</span>
                <span className="text-xs text-amber-400/80">结算市场</span>
              </div>
              {!showResolveOptions ? (
                <button
                  onClick={() => setShowResolveOptions(true)}
                  disabled={isResolving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm"
                >
                  结算市场
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolveMarket("YES")}
                    disabled={isResolving}
                    className="px-4 py-2 bg-pm-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        YES 获胜
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleResolveMarket("NO")}
                    disabled={isResolving}
                    className="px-4 py-2 bg-pm-red hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        NO 获胜
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleResolveMarket("Invalid")}
                    disabled={isResolving}
                    className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        无效
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowResolveOptions(false)}
                    disabled={isResolving}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 用户仓位显示区域（从交易成功回调） */}
        {apiTradePosition && (
          <div className="mb-6 p-4 rounded-xl border border-pm-border bg-pm-card">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-pm-text-dim uppercase tracking-wider">
                  Your Position
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">
                    {apiTradePosition.shares.toFixed(2)} {apiTradePosition.outcome} shares
                  </span>
                  <span className="text-pm-text-dim text-sm">
                    @ {formatUSD(apiTradePosition.avgPrice)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-pm-text-dim uppercase tracking-wider">
                  Total Value
                </span>
                <span className="text-pm-green font-bold text-lg">
                  {formatUSD(apiTradePosition.totalValue)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Price Chart */}
        <div className="flex-1">
          <PriceChart 
            yesPercent={marketData.yesPercent} 
            marketStatus={marketStatus} 
            marketResult={marketResult} 
          />
        </div>

        {/* User Position Card - 显示所有持仓 */}
        {userPosition && (
          <>
            {userPosition.yesShares > 0 && (
              <UserPositionCard
                position={{
                  shares: userPosition.yesShares,
                  avgPrice: userPosition.yesAvgPrice,
                  currentPrice: marketData.status === "RESOLVED" 
                    ? (marketData.winningOutcome === "YES" ? 1.0 : 0.0)
                    : marketData.yesPercent / 100,
                  outcome: "yes",
                }}
                onSell={handleSell}
                onSellClick={() => handleQuickSell("yes")}
                marketTitle={marketData.title}
                marketStatus={marketData.status}
                winningOutcome={marketData.winningOutcome}
              />
            )}
            {userPosition.noShares > 0 && (
              <UserPositionCard
                position={{
                  shares: userPosition.noShares,
                  avgPrice: userPosition.noAvgPrice,
                  currentPrice: marketData.status === "RESOLVED"
                    ? (marketData.winningOutcome === "NO" ? 1.0 : 0.0)
                    : marketData.noPercent / 100,
                  outcome: "no",
                }}
                onSell={handleSell}
                onSellClick={() => handleQuickSell("no")}
                marketTitle={marketData.title}
                marketStatus={marketData.status}
                winningOutcome={marketData.winningOutcome}
              />
            )}
          </>
        )}

        {/* Order Book / Tabs */}
        {/* 修复详情页订单列表：传递用户订单数据 */}
        <OrderBook 
          activeTab={detailTab}
          onTabChange={setDetailTab}
          marketTitle={marketData.title}
          endDate={new Date(marketData.endTime).toISOString().split("T")[0]}
          userOrders={marketData.userOrders || []}
          marketId={marketData.id}
        />
      </div>

      {/* Trade Sidebar */}
      <div className="w-[380px]">
        <TradeSidebar
          ref={tradeSidebarRef}
          yesPercent={marketData.yesPercent}
          noPercent={marketData.noPercent}
          marketId={marketData.id}
          userPosition={userPosition}
          marketTitle={marketData.title}
          marketStatus={marketData.status}
          winningOutcome={marketData.winningOutcome}
          activeTab={tradeTab}
          onTabChange={setTradeTab}
          amount={tradeAmount}
          onAmountChange={setTradeAmount}
          feeRate={feeRate}
          onTradeSuccess={handleTradeSuccess}
        />
      </div>
          </>
        );
      })()}
    </main>
  );
}
