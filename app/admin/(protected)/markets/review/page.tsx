"use client";

import { useState, useEffect } from "react";
import { Check, X, CheckCheck, Loader2, XCircle, Languages } from "lucide-react";

interface PendingMarket {
  id: string;
  title: string;
  titleZh?: string | null; // 中文标题（可选）
  description: string;
  descriptionZh?: string | null; // 中文描述（可选）
  category?: string;
  totalVolume: number;
  yesProbability: number;
  noProbability: number;
  closingDate: string;
  externalId?: string;
  externalSource?: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  level?: number;
  parentId?: string | null;
  children?: Category[];
}

export default function MarketReviewPage() {
  const [markets, setMarkets] = useState<PendingMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // 翻译编辑对话框状态
  const [editingMarket, setEditingMarket] = useState<PendingMarket | null>(null);
  const [editTitleZh, setEditTitleZh] = useState('');
  const [editDescriptionZh, setEditDescriptionZh] = useState('');
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);
  
  // 🔥 分类选择状态：每个市场对应的选中分类ID
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  // 🔥 分类列表
  const [categories, setCategories] = useState<Category[]>([]);

  // 获取待审核市场列表
  const fetchPendingMarkets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 [Review Frontend] 开始请求待审核市场列表...');
      const response = await fetch("/api/admin/markets/review", {
        cache: 'no-store', // 🔥 强制刷新，不使用缓存
      });
      
      console.log(`📥 [Review Frontend] API 响应状态: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Review Frontend] API 响应错误:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`📊 [Review Frontend] API 返回结果:`, {
        success: result.success,
        dataLength: result.data?.length || 0,
        dataType: Array.isArray(result.data) ? 'Array' : typeof result.data,
      });
      
      if (result.success) {
        const data = result.data || [];
        console.log(`✅ [Review Frontend] 成功获取 ${data.length} 条待审核市场`);
        setMarkets(data);
      } else {
        console.error(`❌ [Review Frontend] API 返回失败:`, result.error);
        throw new Error(result.error || "获取数据失败");
      }
    } catch (err) {
      console.error("❌ [Review Frontend] 获取待审核市场失败:", err);
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      const data = await response.json();
      if (data.success && data.data) {
        // 🔥 只获取顶级分类和一级子分类，用于审核时的分类选择
        const flatCategories: Category[] = [];
        data.data.forEach((cat: Category) => {
          flatCategories.push(cat);
          if (cat.children && cat.children.length > 0) {
            cat.children.forEach((child: Category) => {
              flatCategories.push(child);
            });
          }
        });
        setCategories(flatCategories);
      }
    } catch (err) {
      console.error("获取分类列表失败:", err);
    }
  };

  useEffect(() => {
    fetchPendingMarkets();
    fetchCategories();
  }, []);

  // 🔥 根据标题内容自动推断分类
  const inferCategoryFromTitle = (title: string): string | null => {
    const titleLower = title.toLowerCase();
    
    // 加密货币关键词
    if (titleLower.match(/bitcoin|btc|ethereum|eth|crypto|加密货币|数字货币|比特币|以太坊/)) {
      const cryptoCategory = categories.find(c => c.slug === 'crypto' || c.name.includes('加密货币'));
      return cryptoCategory?.id || null;
    }
    
    // 科技关键词
    if (titleLower.match(/tech|technology|ai|artificial intelligence|科技|人工智能|苹果|apple|google|meta|microsoft/)) {
      const techCategory = categories.find(c => c.slug === 'tech' || c.slug === 'technology' || c.name.includes('科技'));
      return techCategory?.id || null;
    }
    
    // 政治关键词
    if (titleLower.match(/politics|election|president|politician|政治|选举|总统|国会/)) {
      const politicsCategory = categories.find(c => c.slug === 'politics' || c.name.includes('政治'));
      return politicsCategory?.id || null;
    }
    
    // 体育关键词
    if (titleLower.match(/sports|football|basketball|soccer|sport|体育|足球|篮球|nfl|nba/)) {
      const sportsCategory = categories.find(c => c.slug === 'sports' || c.name.includes('体育'));
      return sportsCategory?.id || null;
    }
    
    // 默认返回热门分类
    const hotCategory = categories.find(c => c.slug === 'hot' || c.name.includes('热门'));
    return hotCategory?.id || null;
  };

  // 审核通过（单个）
  const handleApprove = async (marketId: string) => {
    try {
      // 🔥 获取选中的分类ID
      let categoryId = selectedCategories[marketId];
      
      // 🔥 如果未选择分类，尝试自动推断
      if (!categoryId) {
        const market = markets.find(m => m.id === marketId);
        if (market) {
          categoryId = inferCategoryFromTitle(market.title);
        }
      }
      
      // 🔥 如果推断失败，后端会自动使用默认分类（热门），但前端仍然允许继续
      // 这是为了用户体验：即使前端推断失败，后端也会处理默认分类
      
      setProcessingIds(prev => new Set(prev).add(marketId));
      
      const response = await fetch(`/api/admin/markets/${marketId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "approve", // approve 或 reject
          categoryId: categoryId, // 🔥 传递分类ID
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

  // 忽略（单个）- 直接删除记录
  const handleIgnore = async (marketId: string) => {
    if (!confirm("确定要忽略这个事件吗？事件将被删除，如果未来交易量上涨重新进入 Top 100，会再次出现在待审核列表中。")) {
      return;
    }

    try {
      setProcessingIds(prev => new Set(prev).add(marketId));
      
      const response = await fetch(`/api/admin/markets/${marketId}/review`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "忽略失败");
      }

      // 从列表中移除已忽略的市场
      setMarkets(prev => prev.filter(m => m.id !== marketId));
    } catch (err) {
      console.error("❌ [Review] 忽略失败:", err);
      const errorMessage = err instanceof Error ? err.message : "忽略失败，请重试";
      alert(`忽略失败: ${errorMessage}`);
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

  // 打开翻译编辑对话框
  const handleEditTranslation = (market: PendingMarket) => {
    setEditingMarket(market);
    setEditTitleZh(market.titleZh || '');
    setEditDescriptionZh(market.descriptionZh || '');
  };

  // 关闭翻译编辑对话框
  const handleCloseTranslationDialog = () => {
    setEditingMarket(null);
    setEditTitleZh('');
    setEditDescriptionZh('');
  };

  // 保存翻译
  const handleSaveTranslation = async () => {
    if (!editingMarket) return;

    try {
      setIsSavingTranslation(true);

      const response = await fetch(`/api/admin/markets/${editingMarket.id}/translate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titleZh: editTitleZh.trim() || null,
          descriptionZh: editDescriptionZh.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '保存翻译失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '保存翻译失败');
      }

      // 更新本地状态
      setMarkets(prev => prev.map(m => 
        m.id === editingMarket.id 
          ? { ...m, titleZh: editTitleZh.trim() || null, descriptionZh: editDescriptionZh.trim() || null }
          : m
      ));

      // 关闭对话框
      handleCloseTranslationDialog();
      alert('翻译已保存成功！');
    } catch (err) {
      console.error('保存翻译失败:', err);
      alert(err instanceof Error ? err.message : '保存翻译失败，请重试');
    } finally {
      setIsSavingTranslation(false);
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
                      {/* 优先显示中文标题，如果为空则显示英文并标注"待翻译" */}
                      {market.titleZh ? (
                        market.titleZh
                      ) : (
                        <>
                          {market.title}
                          <span 
                            className="ml-2 text-xs text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded cursor-pointer hover:bg-yellow-400/30 transition-colors"
                            onClick={() => handleEditTranslation(market)}
                            title="点击编辑翻译"
                          >
                            待翻译
                          </span>
                        </>
                      )}
                    </h3>
                    
                    {(market.descriptionZh || market.description) && (
                      <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                        {market.descriptionZh || market.description}
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
                        {/* 0% 或 100% 赔率预警 */}
                        {(market.yesProbability === 0 || market.yesProbability === 100 || 
                          market.noProbability === 0 || market.noProbability === 100) ? (
                          <span className="text-red-500 font-bold bg-red-500/20 px-2 py-1 rounded border border-red-500/50">
                            ⚠️ YES {market.yesProbability}% / NO {market.noProbability}% (已死盘)
                          </span>
                        ) : (
                          <>
                            <span className="text-pm-green font-medium">
                              YES {market.yesProbability}%
                            </span>
                            <span className="text-text-secondary mx-1">/</span>
                            <span className="text-red-400 font-medium">
                              NO {market.noProbability}%
                            </span>
                          </>
                        )}
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
                    {/* 🔥 分类选择下拉框 */}
                    <select
                      value={selectedCategories[market.id] || ''}
                      onChange={(e) => {
                        setSelectedCategories(prev => ({
                          ...prev,
                          [market.id]: e.target.value,
                        }));
                      }}
                      className="px-3 py-2 bg-surface-dark border border-border-dark rounded-lg text-white text-sm focus:outline-none focus:border-primary transition-colors min-w-[150px]"
                      disabled={isProcessing}
                    >
                      <option value="">选择分类...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    
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
                      onClick={() => handleIgnore(market.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-lg text-yellow-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="忽略此事件（删除记录，如果未来交易量上涨会重新出现）"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      忽略
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

      {/* 翻译编辑对话框 */}
      {editingMarket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-dark rounded-lg border border-border-dark p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Languages className="w-5 h-5 text-primary" />
                编辑翻译
              </h2>
              <button
                onClick={handleCloseTranslationDialog}
                className="text-text-secondary hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 英文原文 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">英文标题</label>
                <div className="bg-surface-dark/50 border border-border-dark rounded-lg p-3 text-white text-sm">
                  {editingMarket.title}
                </div>
              </div>

              {/* 中文标题 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  中文标题 <span className="text-primary">*</span>
                </label>
                <textarea
                  value={editTitleZh}
                  onChange={(e) => setEditTitleZh(e.target.value)}
                  className="w-full bg-surface-dark/50 border border-border-dark rounded-lg p-3 text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  rows={2}
                  placeholder="请输入中文标题"
                />
              </div>

              {/* 英文描述 */}
              {editingMarket.description && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">英文描述</label>
                  <div className="bg-surface-dark/50 border border-border-dark rounded-lg p-3 text-white text-sm max-h-32 overflow-y-auto">
                    {editingMarket.description}
                  </div>
                </div>
              )}

              {/* 中文描述 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">中文描述</label>
                <textarea
                  value={editDescriptionZh}
                  onChange={(e) => setEditDescriptionZh(e.target.value)}
                  className="w-full bg-surface-dark/50 border border-border-dark rounded-lg p-3 text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  rows={4}
                  placeholder="请输入中文描述（可选）"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={handleCloseTranslationDialog}
                disabled={isSavingTranslation}
                className="px-4 py-2 text-text-secondary hover:text-white transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveTranslation}
                disabled={isSavingTranslation || !editTitleZh.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingTranslation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    保存翻译
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
