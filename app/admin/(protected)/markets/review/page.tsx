"use client";

import { useState, useEffect } from "react";
import { Check, X, CheckCheck, Loader2 } from "lucide-react";

interface PendingMarket {
  id: string;
  title: string;
  description: string;
  category?: string;
  totalVolume: number;
  yesProbability: number;
  noProbability: number;
  closingDate: string;
  externalId?: string;
  externalSource?: string;
  createdAt: string;
}

export default function MarketReviewPage() {
  const [markets, setMarkets] = useState<PendingMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // 获取待审核市场列表
  const fetchPendingMarkets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/admin/markets/review");
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const data = result.data || [];
        setMarkets(data);
      } else {
        throw new Error(result.error || "获取数据失败");
      }
    } catch (err) {
      console.error("❌ [Review] 获取待审核市场失败:", err);
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingMarkets();
  }, []);

  // 审核通过（单个）
  const handleApprove = async (marketId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(marketId));
      
      const response = await fetch(`/api/admin/markets/${marketId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "approve", // approve 或 reject
        }),
      });

      if (!response.ok) {
        // 获取详细的错误信息
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "审核失败");
      }

      // 从列表中移除已审核的市场
      setMarkets(prev => prev.filter(m => m.id !== marketId));
      
      // 刷新列表（重新获取数据，确保数据同步）
      await fetchPendingMarkets();
    } catch (err) {
      console.error("❌ [Review] 审核失败:", err);
      const errorMessage = err instanceof Error ? err.message : "审核失败，请重试";
      alert(`审核失败: ${errorMessage}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
    }
  };

  // 拒绝（单个）
  const handleReject = async (marketId: string) => {
    if (!confirm("确定要永久拒绝这个事件吗？此操作不可撤销。")) {
      return;
    }

    try {
      setProcessingIds(prev => new Set(prev).add(marketId));
      
      const response = await fetch(`/api/admin/markets/${marketId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reject",
        }),
      });

      if (!response.ok) {
        // 获取详细的错误信息
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "拒绝失败");
      }

      // 从列表中移除已拒绝的市场
      setMarkets(prev => prev.filter(m => m.id !== marketId));
      
      // 刷新列表（重新获取数据，确保数据同步）
      await fetchPendingMarkets();
    } catch (err) {
      console.error("❌ [Review] 拒绝失败:", err);
      const errorMessage = err instanceof Error ? err.message : "拒绝失败，请重试";
      alert(`拒绝失败: ${errorMessage}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
    }
  };

  // 批量审核通过
  const handleBatchApprove = async () => {
    if (markets.length === 0) {
      alert("没有待审核的市场");
      return;
    }

    if (!confirm(`确定要批量审核通过本页所有 ${markets.length} 个事件吗？`)) {
      return;
    }

    try {
      const allIds = markets.map(m => m.id);
      setProcessingIds(new Set(allIds));
      
      const response = await fetch("/api/admin/markets/review/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "approve",
          marketIds: allIds,
        }),
      });

      if (!response.ok) {
        // 获取详细的错误信息
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "批量审核失败");
      }

      // 刷新列表（重新获取数据）
      await fetchPendingMarkets();
      alert(`成功审核通过 ${result.count || allIds.length} 个事件`);
    } catch (err) {
      console.error("批量审核失败:", err);
      alert(err instanceof Error ? err.message : "批量审核失败，请重试");
    } finally {
      setProcessingIds(new Set());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          <p className="font-bold mb-2">获取数据失败</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2 text-text-secondary">
            提示：运行 <code className="bg-black/30 px-1 rounded">npx tsx scripts/seed-pending-markets.ts</code> 创建测试数据
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">全网事件审核中心</h1>
          <p className="text-text-secondary">
            待审核事件：<span className="text-primary font-bold">{markets.length}</span> 个
          </p>
        </div>
        
        {markets.length > 0 && (
          <button
            onClick={handleBatchApprove}
            disabled={processingIds.size > 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-primary font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" />
            批量审核通过
          </button>
        )}
      </div>

      {markets.length === 0 ? (
        <div className="bg-surface-dark rounded-lg border border-border-dark p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-text-secondary text-lg">暂无待审核事件</p>
          <p className="text-text-secondary text-sm mt-2">所有事件都已审核完成</p>
        </div>
      ) : (
        <div className="space-y-4">
          {markets.map((market) => {
            const isProcessing = processingIds.has(market.id);
            
            return (
              <div
                key={market.id}
                className="bg-surface-dark rounded-lg border border-border-dark p-6 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {market.title}
                    </h3>
                    
                    {market.description && (
                      <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                        {market.description}
                      </p>
                    )}

                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-text-secondary">分类：</span>
                        <span className="text-white">{market.category || "未分类"}</span>
                      </div>
                      
                      <div>
                        <span className="text-text-secondary">交易量：</span>
                        <span className="text-primary font-bold">
                          ${(market.totalVolume / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-text-secondary">概率：</span>
                        <span className="text-pm-green font-medium">
                          YES {market.yesProbability}%
                        </span>
                        <span className="text-text-secondary mx-1">/</span>
                        <span className="text-red-400 font-medium">
                          NO {market.noProbability}%
                        </span>
                      </div>

                      {market.externalId && (
                        <div>
                          <span className="text-text-secondary">来源：</span>
                          <span className="text-white">{market.externalSource || "polymarket"}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-text-secondary">
                      创建时间：{new Date(market.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(market.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-pm-green/20 hover:bg-pm-green/30 border border-pm-green/50 rounded-lg text-pm-green font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      审核通过
                    </button>

                    <button
                      onClick={() => handleReject(market.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      永久拒绝
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
