"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import TradeSidebar, { TradeSidebarRef } from "@/components/market-detail/TradeSidebar";
import UserPositionCard from "@/components/market-detail/UserPositionCard";
import { useStore } from "@/app/context/StoreContext";

// 新的持仓接口：支持同时持有 YES 和 NO
interface UserPosition {
  yesShares: number;
  noShares: number;
  yesAvgPrice: number;
  noAvgPrice: number;
}

// MOCK_MARKETS 数据字典 - 使用数字字符串 ID 以匹配首页链接
const MOCK_MARKETS: Record<string, {
  id: string;
  title: string;
  status: "OPEN" | "RESOLVED";
  winningOutcome: "YES" | "NO" | null;
  yesPercent: number;
  noPercent: number;
  initialPosition: UserPosition | null;
  image?: string;
  volume: string;
  endDate: string;
  feeRate: number; // 交易费率（例如 0.02 表示 2%）
}> = {
  "1": {
    id: "1",
    title: "2024年比特币会达到10万美元吗？",
    status: "OPEN",
    winningOutcome: null,
    yesPercent: 32,
    noPercent: 68,
    initialPosition: {
      yesShares: 21.15, // 与钱包页数据对齐
      noShares: 0,
      yesAvgPrice: 0.52,
      noAvgPrice: 0,
    },
    image: "/images/btc.png",
    volume: "$42M",
    endDate: "2024-12-31",
    feeRate: 0.02, // 2% 费率
  },
  "2": {
    id: "2",
    title: "美联储 5 月宣布降息？",
    status: "RESOLVED",
    winningOutcome: "YES",
    yesPercent: 100, // 已结束，YES 获胜
    noPercent: 0,
    initialPosition: {
      yesShares: 1000, // 用户赢了，显示绿色 Banner，需测试兑换
      noShares: 0,
      yesAvgPrice: 0.40,
      noAvgPrice: 0,
    },
    image: "/images/fed.png",
    volume: "$8.2M",
    endDate: "2024-05-31",
    feeRate: 0.01, // 1% 费率（已结束市场，较低费率）
  },
  "3": {
    id: "3",
    title: "星舰 (Starship) 轨道飞行成功？",
    status: "RESOLVED",
    winningOutcome: "NO",
    yesPercent: 0, // 已结束，NO 获胜
    noPercent: 100,
    initialPosition: {
      yesShares: 200, // 输掉的持仓
      noShares: 500, // 用户赢了，显示红色 Banner，需测试兑换
      yesAvgPrice: 0.60,
      noAvgPrice: 0.40,
    },
    image: "/images/spacex.png",
    volume: "$5.9M",
    endDate: "2024-06-15",
    feeRate: 0.015, // 1.5% 费率
  },
};

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const market = MOCK_MARKETS[id];
  const { positions: storePositions } = useStore();
  
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [detailTab, setDetailTab] = useState<"orderbook" | "comments" | "holders" | "rules">("orderbook");
  const [tradeAmount, setTradeAmount] = useState("");
  const tradeSidebarRef = useRef<TradeSidebarRef>(null);

  // 从 Store 实时查找当前市场的持仓
  const yesPosition = storePositions.find(p => p.marketId === id && p.outcome === 'YES');
  const noPosition = storePositions.find(p => p.marketId === id && p.outcome === 'NO');
  
  // 转换为 UserPosition 格式
  const userPosition: UserPosition | null = (yesPosition || noPosition) ? {
    yesShares: yesPosition?.shares || 0,
    noShares: noPosition?.shares || 0,
    yesAvgPrice: yesPosition?.avgPrice || 0,
    noAvgPrice: noPosition?.avgPrice || 0,
  } : null;

  // 当用户手动切换 Tab 时（从 sell 切换到 buy），清空输入
  useEffect(() => {
    if (tradeTab === "buy") {
      setTradeAmount("");
    }
  }, [tradeTab]);


  // 如果市场不存在，显示错误信息
  if (!market) {
    return (
      <main className="flex-1 w-full max-w-[1280px] mx-auto p-8">
        <div className="flex flex-col items-center justify-center py-20">
          <h1 className="text-2xl font-bold text-white mb-4">Market not found</h1>
          <p className="text-zinc-500 mb-6">The market you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-pm-green hover:bg-green-400 text-pm-bg font-bold rounded-xl transition-colors"
          >
            返回首页
          </button>
        </div>
      </main>
    );
  }

  // 创建 MarketEvent 对象用于 MarketHeader
  const mockEvent = {
    id: parseInt(market.id),
    rank: 1,
    title: market.title,
    category: "测试",
    categorySlug: "test",
    icon: "Bitcoin",
    iconColor: "bg-[#f7931a]",
    yesPercent: market.yesPercent,
    noPercent: market.noPercent,
    deadline: market.endDate,
    imageUrl: market.image,
    volume: market.volume,
    comments: 0,
  };

  // 转换状态格式用于 MarketHeader
  const marketStatus = market.status === "OPEN" ? "open" : "closed";
  const marketResult = market.winningOutcome === "YES" ? "YES_WON" : 
                       market.winningOutcome === "NO" ? "NO_WON" : null;

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

  return (
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-8 flex flex-row gap-8">
      <div className="flex-1 flex flex-col">
        {/* Market Header */}
        <MarketHeader event={mockEvent} status={marketStatus} result={marketResult} />

        {/* Price Chart */}
        <div className="flex-1">
          <PriceChart 
            yesPercent={market.yesPercent} 
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
                  currentPrice: market.status === "RESOLVED" 
                    ? (market.winningOutcome === "YES" ? 1.0 : 0.0)
                    : market.yesPercent / 100,
                  outcome: "yes",
                }}
                onSell={handleSell}
                onSellClick={() => handleQuickSell("yes")}
                marketTitle={market.title}
                marketStatus={market.status}
                winningOutcome={market.winningOutcome}
              />
            )}
            {userPosition.noShares > 0 && (
              <UserPositionCard
                position={{
                  shares: userPosition.noShares,
                  avgPrice: userPosition.noAvgPrice,
                  currentPrice: market.status === "RESOLVED"
                    ? (market.winningOutcome === "NO" ? 1.0 : 0.0)
                    : market.noPercent / 100,
                  outcome: "no",
                }}
                onSell={handleSell}
                onSellClick={() => handleQuickSell("no")}
                marketTitle={market.title}
                marketStatus={market.status}
                winningOutcome={market.winningOutcome}
              />
            )}
          </>
        )}

        {/* Order Book / Tabs */}
        <OrderBook 
          activeTab={detailTab}
          onTabChange={setDetailTab}
          marketTitle={market.title}
          endDate={market.endDate}
        />
      </div>

      {/* Trade Sidebar */}
      <div className="w-[380px]">
        <TradeSidebar
          ref={tradeSidebarRef}
          yesPercent={market.yesPercent}
          noPercent={market.noPercent}
          marketId={parseInt(market.id)}
          userPosition={userPosition}
          marketTitle={market.title}
          marketStatus={market.status}
          winningOutcome={market.winningOutcome}
          activeTab={tradeTab}
          onTabChange={setTradeTab}
          amount={tradeAmount}
          onAmountChange={setTradeAmount}
          feeRate={market.feeRate}
        />
      </div>
    </main>
  );
}
