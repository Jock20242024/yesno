"use client";

import { useState, useEffect } from "react";
import { formatUSD } from "@/lib/utils";
import CommentsTab from "./tabs/CommentsTab";
import HoldersTab from "./tabs/HoldersTab";
import RulesTab from "./tabs/RulesTab";
import { useLanguage } from "@/i18n/LanguageContext";

type DetailTab = "orderbook" | "comments" | "holders" | "rules";

interface OrderBookProps {
  activeTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
  marketTitle?: string;
  endDate?: string;
  userOrders?: any[]; // 修复详情页订单列表：接收用户订单数据
  marketId?: string; // 市场 ID
  onPriceSelect?: (price: number) => void; // 🔥 新增：点击订单簿价格时的回调
}

interface OrderBookData {
  asks: Array<{ price: number; quantity: number; total: number }>;
  bids: Array<{ price: number; quantity: number; total: number }>;
  spread: number;
  currentPrice: number;
}

export default function OrderBook({ 
  activeTab = "orderbook", 
  onTabChange,
  marketTitle,
  endDate,
  userOrders = [], // 修复详情页订单列表：使用从 API 获取的用户订单
  marketId,
  onPriceSelect, // 🔥 新增：点击价格回调
}: OrderBookProps) {
  const { t } = useLanguage();
  const [orderBookData, setOrderBookData] = useState<OrderBookData | null>(null);
  const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(true);
  const [orderBookError, setOrderBookError] = useState<string | null>(null);

  // 🔥 逻辑守卫：确保必要数据存在
  if (!marketId) {
    return (
      <div className="flex-1 bg-pm-card rounded-xl border border-pm-border p-4">
        <div className="text-pm-text-dim text-center py-8">{t('market.orderbook.loading_order_data')}</div>
      </div>
    );
  }

  // 🔥 获取真实订单簿数据（初始加载）
  useEffect(() => {
    if (!marketId || activeTab !== "orderbook") return;

    const fetchOrderBook = async () => {
      try {
        setIsLoadingOrderBook(true);
        setOrderBookError(null);

        const response = await fetch(`/api/markets/${marketId}/orderbook`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch order book');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setOrderBookData(result.data);
        } else {
          throw new Error(result.error || 'Invalid response format');
        }
      } catch (err) {
        console.error('Failed to fetch order book:', err);
        setOrderBookError(err instanceof Error ? err.message : 'Failed to load order book');
      } finally {
        setIsLoadingOrderBook(false);
      }
    };

    fetchOrderBook();
  }, [marketId, activeTab]);

  // 🔥 Pusher实时推送订阅（替换原生WebSocket）
  useEffect(() => {
    if (!marketId || activeTab !== "orderbook") return;

    // 动态导入pusher-js（仅在客户端）
    let pusher: any = null;
    let channel: any = null;
    let lastSequenceId = 0; // 🔥 修复竞态条件：记录最后处理的序列号

    const initPusher = async () => {
      try {
        const Pusher = (await import('pusher-js')).default;
        
        pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || 'e733fc62c101670f5059', {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap3',
          forceTLS: true,
        });

        channel = pusher.subscribe(`market-${marketId}`);

        // 订阅订单簿更新事件
        channel.bind('orderbook-update', (data: any) => {
          // 🔥 修复竞态条件：检查序列号，丢弃旧消息
          const sequenceId = data.sequenceId || 0;
          const timestamp = data.timestamp || 0;
          
          if (sequenceId <= lastSequenceId) {
            console.warn(`⚠️ [Pusher] 收到旧消息，已丢弃: sequenceId=${sequenceId}, lastSequenceId=${lastSequenceId}`);
            return; // 丢弃旧消息，避免盘口价格"反复横跳"
          }
          
          lastSequenceId = sequenceId;
          console.log(`📡 [Pusher] 收到订单簿更新: sequenceId=${sequenceId}, timestamp=${timestamp}`);
          
          // 更新订单簿UI（只更新前10档）
          setOrderBookData((prev) => {
            if (!prev) {
              return {
                asks: data.asks || [],
                bids: data.bids || [],
                spread: data.spread || 0,
                currentPrice: data.currentPrice || 0.5,
              };
            }
            
            // 合并更新（保留原有数据，更新前10档）
            return {
              ...prev,
              asks: [...(data.asks || []), ...prev.asks.slice(10)],
              bids: [...(data.bids || []), ...prev.bids.slice(10)],
              spread: data.spread !== undefined ? data.spread : prev.spread,
              currentPrice: data.currentPrice !== undefined ? data.currentPrice : prev.currentPrice,
            };
          });
        });

        console.log(`✅ [Pusher] 已订阅频道: market-${marketId}`);
      } catch (error) {
        console.error('❌ [Pusher] 初始化失败:', error);
      }
    };

    initPusher();

    // 清理函数：取消订阅
    return () => {
      if (channel) {
        channel.unbind('orderbook-update');
        channel.unsubscribe();
      }
      if (pusher) {
        pusher.disconnect();
      }
    };
  }, [marketId, activeTab]);

  // 转换订单簿数据为表格格式
  const orders = orderBookData 
    ? [
        ...orderBookData.asks.map(ask => ({
          price: ask.price,
          quantity: ask.quantity,
          total: ask.total,
          type: "sell" as const,
        })),
        ...orderBookData.bids.map(bid => ({
          price: bid.price,
          quantity: bid.quantity,
          total: bid.total,
          type: "buy" as const,
        })),
      ]
    : [];

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "orderbook", label: t('market.orderbook.title') },
    { id: "comments", label: t('market.orderbook.comments') },
    { id: "holders", label: t('market.orderbook.holders') },
    { id: "rules", label: t('market.orderbook.rules') },
  ];

  const handleTabClick = (tab: DetailTab) => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden relative z-10">
      {/* 🔥 确保标签页总是可见 - 使用更明显的样式和背景，提升层级 */}
      <div className="border-b border-pm-border flex gap-4 md:gap-8 mb-4 w-full overflow-x-auto py-2 min-h-[48px] items-end relative z-10 bg-transparent">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            type="button"
            className={`pb-3 border-b-2 text-sm font-bold transition-colors whitespace-nowrap px-1 cursor-pointer ${
              activeTab === tab.id
                ? "border-pm-text text-white border-opacity-100"
                : "border-transparent text-pm-text-dim hover:text-white hover:border-pm-text-dim hover:border-opacity-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容区域 */}
      <div>
        {activeTab === "orderbook" && (
          <div className="bg-pm-card rounded-xl border border-pm-border overflow-hidden">
            {isLoadingOrderBook ? (
              <div className="text-pm-text-dim text-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-pm-text-dim border-t-primary rounded-full animate-spin"></div>
                  <span className="text-sm">{t('market.orderbook.loading')}</span>
                </div>
              </div>
            ) : orderBookError ? (
              <div className="text-pm-red text-center py-12">
                {orderBookError}
              </div>
            ) : orderBookData && orders.length > 0 ? (
              <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pm-card-hover text-xs font-semibold text-pm-text-dim uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6 text-left">{t('market.orderbook.price_usd')}</th>
                    <th className="py-3 px-6 text-right">{t('market.orderbook.quantity')}</th>
                    <th className="py-3 px-6 text-right">{t('market.orderbook.total_usd')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pm-border">
                  {/* 卖单（从高到低显示，但实际排序是从低到高） */}
                  {orderBookData.asks
                    .slice()
                    .reverse() // 反转数组，使价格最高的卖单显示在最上面
                    .map((order: any, index: number) => (
                      <tr
                        key={`sell-${index}`}
                        className={`hover:bg-pm-card-hover transition-colors cursor-pointer ${
                          (order as any).orderCount === -1 ? 'opacity-60' : '' // 🔥 AMM虚拟订单半透明显示
                        }`}
                        onClick={() => {
                          // 🔥 点击填充价格：触发回调，将价格传递给父组件
                          if (onPriceSelect) {
                            onPriceSelect(order.price);
                          }
                        }}
                        title={(order as any).orderCount === -1 ? 'AMM虚拟订单（系统流动性）' : ''}
                      >
                        <td className="py-2.5 px-6 font-mono text-pm-red">
                          {formatUSD(order.price)}
                        </td>
                        <td className="py-2.5 px-6 text-right text-white font-mono">
                          {order.quantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-6 text-right text-pm-text-dim font-mono">
                          {formatUSD(order.total)}
                        </td>
                      </tr>
                    ))}
                  {/* 价差行 */}
                  <tr>
                    <td
                      className="py-1 px-6 bg-pm-card-hover/30 text-center text-xs text-pm-text-dim font-mono tracking-widest"
                      colSpan={3}
                    >
                      {orderBookData.spread > 0 
                        ? `--- ${t('market.orderbook.spread')}: ${formatUSD(orderBookData.spread)} ---`
                        : `--- ${t('market.orderbook.spread')}: N/A ---`}
                    </td>
                  </tr>
                  {/* 买单（从高到低显示） */}
                  {orderBookData.bids.map((order: any, index: number) => (
                      <tr
                        key={`buy-${index}`}
                        className={`hover:bg-pm-card-hover transition-colors cursor-pointer ${
                          (order as any).orderCount === -1 ? 'opacity-60' : '' // 🔥 AMM虚拟订单半透明显示
                        }`}
                        onClick={() => {
                          // 🔥 点击填充价格：触发回调，将价格传递给父组件
                          if (onPriceSelect) {
                            onPriceSelect(order.price);
                          }
                        }}
                        title={(order as any).orderCount === -1 ? 'AMM虚拟订单（系统流动性）' : ''}
                      >
                        <td className="py-2.5 px-6 font-mono text-pm-green">
                          {formatUSD(order.price)}
                        </td>
                        <td className="py-2.5 px-6 text-right text-white font-mono">
                          {order.quantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-6 text-right text-pm-text-dim font-mono">
                          {formatUSD(order.total)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            ) : (
              <div className="text-pm-text-dim text-center py-12">
                {t('market.orderbook.no_data')}
              </div>
            )}
          </div>
        )}

        {activeTab === "comments" && <CommentsTab marketId={marketId} />}
        {activeTab === "holders" && <HoldersTab marketId={marketId} />}
        {activeTab === "rules" && <RulesTab marketTitle={marketTitle} endDate={endDate} />}
      </div>
    </div>
  );
}

