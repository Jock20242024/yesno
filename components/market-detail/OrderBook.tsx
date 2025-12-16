"use client";

import { formatUSD } from "@/lib/utils";
import CommentsTab from "./tabs/CommentsTab";
import HoldersTab from "./tabs/HoldersTab";
import RulesTab from "./tabs/RulesTab";

type DetailTab = "orderbook" | "comments" | "holders" | "rules";

interface OrderBookProps {
  activeTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
  marketTitle?: string;
  endDate?: string;
  userOrders?: any[]; // 修复详情页订单列表：接收用户订单数据
  marketId?: string; // 市场 ID
}

export default function OrderBook({ 
  activeTab = "orderbook", 
  onTabChange,
  marketTitle,
  endDate,
  userOrders = [], // 修复详情页订单列表：使用从 API 获取的用户订单
  marketId,
}: OrderBookProps) {
  // 修复详情页订单列表：如果提供了用户订单，使用它们；否则使用模拟数据
  // API 调用：确认该组件调用了正确的 API，并且能够正确接收和渲染下注成功后生成的持仓记录
  const orders = userOrders.length > 0 
    ? userOrders.map((order) => {
        // 从订单数据转换为订单簿格式
        // 简化：使用订单金额作为数量，价格需要从市场数据获取（这里使用占位值）
        return {
          price: 0.5, // 占位价格，实际应该从市场数据获取
          quantity: order.amount,
          total: order.amount,
          type: order.outcomeSelection === 'YES' ? 'buy' : 'sell', // 简化映射
        };
      })
    : [
        // 如果没有用户订单，使用模拟数据（向后兼容）
        { price: 0.66, quantity: 800, total: 528.0, type: "sell" },
        { price: 0.67, quantity: 2100, total: 1407.0, type: "sell" },
        { price: 0.65, quantity: 1250, total: 812.5, type: "buy" },
        { price: 0.64, quantity: 5000, total: 3200.0, type: "buy" },
      ];

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "orderbook", label: "订单簿" },
    { id: "comments", label: "事件评论" },
    { id: "holders", label: "持有者" },
    { id: "rules", label: "规则" },
  ];

  const handleTabClick = (tab: DetailTab) => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div>
      <div className="border-b border-pm-border flex gap-8 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`pb-3 border-b-2 text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? "border-pm-text text-white"
                : "border-transparent text-pm-text-dim hover:text-white"
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
            <table className="w-full text-sm">
              <thead className="bg-pm-card-hover text-xs font-semibold text-pm-text-dim uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-6 text-left">价格 (USD)</th>
                  <th className="py-3 px-6 text-right">数量 (份)</th>
                  <th className="py-3 px-6 text-right">总计 (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pm-border">
                {orders
                  .filter((order) => order.type === "sell")
                  .map((order, index) => (
                    <tr
                      key={`sell-${index}`}
                      className="hover:bg-pm-card-hover transition-colors"
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
                <tr>
                  <td
                    className="py-1 px-6 bg-pm-card-hover/30 text-center text-xs text-pm-text-dim font-mono tracking-widest"
                    colSpan={3}
                  >
                    --- Spread: $0.01 ---
                  </td>
                </tr>
                {orders
                  .filter((order) => order.type === "buy")
                  .map((order, index) => (
                    <tr
                      key={`buy-${index}`}
                      className="hover:bg-pm-card-hover transition-colors"
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
        )}

        {activeTab === "comments" && <CommentsTab />}
        {activeTab === "holders" && <HoldersTab />}
        {activeTab === "rules" && <RulesTab marketTitle={marketTitle} endDate={endDate} />}
      </div>
    </div>
  );
}

