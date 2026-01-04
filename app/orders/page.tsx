"use client";

// 🔥 强制动态渲染：防止构建时数据请求失败
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUserOrders } from "@/hooks/useUserOrders";
import OrderHistoryTable, { OrderHistoryItem } from "@/components/profile/OrderHistoryTable";
import { Order } from "@/types/data";
import { Loader2 } from "lucide-react";

export default function OrdersPage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { orders, isLoading, error, refetch } = useUserOrders();
  const [marketTitles, setMarketTitles] = useState<Record<string, string>>({});
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);

  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push("/login?redirect=/orders");
    }
  }, [authLoading, isLoggedIn, router]);

  // 获取所有订单的市场标题
  useEffect(() => {
    const fetchMarketTitles = async () => {
      if (orders.length === 0) return;

      setIsLoadingMarkets(true);
      const marketIds = [...new Set(orders.map(order => order.marketId))];
      const titles: Record<string, string> = {};

      try {
        // 并行获取所有市场的标题
        const promises = marketIds.map(async (marketId) => {
          try {
            const response = await fetch(`/api/markets/${marketId}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                titles[marketId] = result.data.title;
              }
            }
          } catch (error) {
            console.error(`Error fetching market ${marketId}:`, error);
            titles[marketId] = "未知市场";
          }
        });

        await Promise.all(promises);
        setMarketTitles(titles);
      } catch (error) {
        console.error("Error fetching market titles:", error);
      } finally {
        setIsLoadingMarkets(false);
      }
    };

    fetchMarketTitles();
  }, [orders]);

  // 将 Order 转换为 OrderHistoryItem
  const orderHistoryItems: OrderHistoryItem[] = useMemo(() => {
    return orders.map((order: Order) => {
      // 注意：Order 表中没有保存 price 和 shares 字段
      // 这里使用简化处理：假设价格为 0.5（即 50%），shares = amount / price
      // 这是合理的估算，因为大多数预测市场的价格在 0.1-0.9 之间，0.5 是中间值
      const estimatedPrice = 0.5; // 估算价格（$0.50）
      const netAmount = order.amount - (order.feeDeducted || 0); // 扣除手续费后的净金额
      const estimatedShares = netAmount / estimatedPrice; // 估算份额

      return {
        id: parseInt(order.id.replace(/-/g, '').substring(0, 10), 16) || 0, // UUID 转数字ID
        timestamp: new Date(order.createdAt).toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        marketId: order.marketId, // 保持 UUID 格式，OrderHistoryTable 组件会处理
        marketTitle: marketTitles[order.marketId] || "加载中...",
        action: "buy" as const, // 订单都是买入操作
        outcome: order.outcomeSelection === "YES" ? "yes" : "no",
        price: estimatedPrice,
        shares: estimatedShares,
        value: order.amount, // 总金额
        status: "success" as const, // 所有订单都是成功的（失败的订单不会出现在列表中）
      };
    });
  }, [orders, marketTitles]);

  if (!authLoading && !isLoggedIn) {
    return null;
  }

  if (isLoading || isLoadingMarkets) {
    return (
      <main className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-white">加载订单中...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-pm-card rounded-xl border border-pm-border p-6">
            <div className="text-center py-12">
              <p className="text-pm-red text-lg font-medium mb-4">加载订单失败</p>
              <p className="text-pm-text-dim text-sm mb-6">{error}</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-pm-green hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">订单历史</h1>
          <p className="text-pm-text-dim text-sm">查看您的所有交易订单</p>
        </div>

        <div className="bg-pm-card rounded-xl border border-pm-border p-6">
          <OrderHistoryTable orders={orderHistoryItems} />
        </div>
      </div>
    </main>
  );
}

