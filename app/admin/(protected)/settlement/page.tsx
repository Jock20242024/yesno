"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dayjs from "dayjs";

interface SettlementMarket {
  id: string;
  title: string;
  closingDate: string;
  updatedAt: string;
  status: string;
  resolvedOutcome: string | null;
  templateId: string | null;
  symbol: string | null;
  strikePrice: number | null;
  isFactory: boolean;
  settlementType: 'Price_Oracle' | 'External_Link';
  settlementEvidence: any;
  isPending: boolean;
  settlementError: string | null;
  settlementAttempts: number;
}

interface AggregatedSeries {
  templateId: string | null;
  title: string;
  symbol: string | null;
  markets: SettlementMarket[];
  hasPending: boolean;
}

interface SettlementData {
  pending: {
    aggregated: AggregatedSeries[];
    raw: SettlementMarket[];
    total: number;
  };
  settled: {
    aggregated: AggregatedSeries[];
    raw: SettlementMarket[];
    total: number;
  };
}

export default function SettlementPage() {
  const [data, setData] = useState<SettlementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [retryingMarkets, setRetryingMarkets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSettlementData();
  }, []);

  const fetchSettlementData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/settlement', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取结算数据失败');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || '获取结算数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取结算数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetrySettlement = async (marketId: string) => {
    try {
      setRetryingMarkets(prev => new Set(prev).add(marketId));

      const response = await fetch('/api/admin/settlement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ marketId }),
      });

      const result = await response.json();

      if (result.success) {
        alert('结算重试成功！');
        fetchSettlementData(); // 刷新数据
      } else {
        alert(`结算重试失败: ${result.error}`);
      }
    } catch (err) {
      alert(`结算重试失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setRetryingMarkets(prev => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
    }
  };

  const handleForceSettle = async (marketId: string, outcome: 'YES' | 'NO') => {
    if (!confirm(`确定要强制结算为 ${outcome} 吗？`)) {
      return;
    }

    try {
      setRetryingMarkets(prev => new Set(prev).add(marketId));

      const response = await fetch('/api/admin/settlement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ marketId, forceOutcome: outcome }),
      });

      const result = await response.json();

      if (result.success) {
        alert('强制结算成功！');
        fetchSettlementData(); // 刷新数据
      } else {
        alert(`强制结算失败: ${result.error}`);
      }
    } catch (err) {
      alert(`强制结算失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setRetryingMarkets(prev => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
    }
  };

  const formatDateTime = (dateString: string) => {
    return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss');
  };

  const formatDate = (dateString: string) => {
    return dayjs(dateString).format('YYYY-MM-DD HH:mm');
  };

  const renderSettlementEvidence = (market: SettlementMarket) => {
    if (!market.settlementEvidence) {
      return <span className="text-gray-400 dark:text-gray-500 text-xs">无结算证据</span>;
    }

    if (market.settlementType === 'Price_Oracle') {
      const { strikePrice, settlementPrice, result } = market.settlementEvidence;
      if (settlementPrice !== null) {
        return (
          <div className="text-xs">
            <span className="text-[#111418] dark:text-white">
              结算价 <span className="font-bold">${settlementPrice.toFixed(2)}</span>
              {' > '}
              行权价 <span className="font-bold">${strikePrice.toFixed(2)}</span>
              {' -> '}
              结果 <span className={`font-bold ${result === 'YES' ? 'text-green-600' : 'text-red-600'}`}>
                {result}
              </span>
            </span>
          </div>
        );
      } else {
        return (
          <div className="text-xs text-gray-400">
            行权价: ${strikePrice.toFixed(2)} (等待结算价)
          </div>
        );
      }
    } else {
      const { externalId, externalSource, externalData } = market.settlementEvidence;
      return (
        <div className="text-xs">
          <div className="text-[#111418] dark:text-white">
            外部源: <span className="font-medium">{externalSource}</span>
          </div>
          {externalId && (
            <div className="text-gray-500 dark:text-gray-400 mt-1">
              ID: {externalId.substring(0, 16)}...
            </div>
          )}
          {externalData && (
            <div className="text-gray-500 dark:text-gray-400 mt-1">
              数据: {JSON.stringify(externalData)}
            </div>
          )}
        </div>
      );
    }
  };

  const renderMarketRow = (market: SettlementMarket, showActions: boolean = true) => (
    <tr
      key={market.id}
      className={`border-b border-[#e5e7eb] dark:border-[#283545] ${
        market.isPending
          ? 'bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
          : 'hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36]'
      } transition-colors`}
    >
      <td className="p-4">
        <div className="text-sm font-medium text-[#111418] dark:text-white">
          {market.title}
        </div>
        {market.symbol && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {market.symbol}
          </div>
        )}
      </td>
      <td className="p-4">
        <div className="text-sm text-[#111418] dark:text-white">
          {formatDate(market.closingDate)}
        </div>
      </td>
      <td className="p-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          market.status === 'RESOLVED'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            : market.isPending
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }`}>
          {market.isPending ? '待结算' : market.status === 'RESOLVED' ? '已结算' : market.status}
        </span>
      </td>
      <td className="p-4">
        <div className="text-sm text-[#111418] dark:text-white">
          {market.settlementType === 'Price_Oracle' ? '价格触发' : '外部同步'}
        </div>
      </td>
      <td className="p-4">
        {renderSettlementEvidence(market)}
      </td>
      <td className="p-4">
        {market.resolvedOutcome ? (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            market.resolvedOutcome === 'YES'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {market.resolvedOutcome}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
        )}
      </td>
      {showActions && (
        <td className="p-4">
          <div className="flex items-center gap-2">
            {market.isPending && (
              <>
                <button
                  onClick={() => handleRetrySettlement(market.id)}
                  disabled={retryingMarkets.has(market.id)}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {retryingMarkets.has(market.id) ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>重试中...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span>一键重试</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleForceSettle(market.id, 'YES')}
                  disabled={retryingMarkets.has(market.id)}
                  className="px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-800 dark:text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  强制YES
                </button>
                <button
                  onClick={() => handleForceSettle(market.id, 'NO')}
                  disabled={retryingMarkets.has(market.id)}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-800 dark:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  强制NO
                </button>
              </>
            )}
            <Link
              href={`/admin/markets/edit/${market.id}?backTo=/admin/settlement`}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors"
            >
              查看详情
            </Link>
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <div className="mx-auto max-w-[1600px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">结算监控中心</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">监控和管理所有市场的结算状态</p>
        </div>
        <button
          onClick={fetchSettlementData}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          刷新数据
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-[#637588] dark:text-[#9da8b9]">加载结算数据...</p>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-red-300 dark:border-red-700 p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-red-500" style={{ fontSize: 48 }}>
              error
            </span>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* 数据展示 */}
      {!isLoading && !error && data && (
        <div className="flex flex-col gap-6">
          {/* 待结算市场 */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545] bg-yellow-50 dark:bg-yellow-900/10">
              <h2 className="text-lg font-bold text-[#111418] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-600">warning</span>
                待结算市场 ({data.pending.total})
              </h2>
              <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">
                已结束但尚未结算，需要管理员处理
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">市场系列</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结束时间</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">状态</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结算类型</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结算证据</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结果</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending.aggregated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#637588] dark:text-[#9da8b9]">
                        暂无待结算的市场
                      </td>
                    </tr>
                  ) : (
                    data.pending.aggregated.map((series) => {
                      const seriesKey = series.templateId || series.markets[0].id;
                      const isExpanded = expandedSeries.has(seriesKey);
                      
                      return (
                        <>
                          {/* 聚合行 */}
                          <tr
                            key={seriesKey}
                            className={`border-b border-[#e5e7eb] dark:border-[#283545] ${
                              series.hasPending
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 font-semibold'
                                : 'hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36]'
                            } transition-colors cursor-pointer`}
                            onClick={() => {
                              const newExpanded = new Set(expandedSeries);
                              if (isExpanded) {
                                newExpanded.delete(seriesKey);
                              } else {
                                newExpanded.add(seriesKey);
                              }
                              setExpandedSeries(newExpanded);
                            }}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">
                                  {isExpanded ? 'expand_less' : 'expand_more'}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-[#111418] dark:text-white">
                                    {series.title}
                                  </div>
                                  {series.symbol && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {series.symbol} ({series.markets.length} 个场次)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-[#111418] dark:text-white">
                              {series.hasPending ? '有待结算' : '-'}
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                待结算 ({series.markets.filter(m => m.isPending).length})
                              </span>
                            </td>
                            <td className="p-4 text-sm text-[#111418] dark:text-white">
                              {series.markets[0]?.settlementType === 'Price_Oracle' ? '价格触发' : '外部同步'}
                            </td>
                            <td className="p-4 text-xs text-gray-500 dark:text-gray-400">
                              -
                            </td>
                            <td className="p-4">
                              <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newExpanded = new Set(expandedSeries);
                                  if (isExpanded) {
                                    newExpanded.delete(seriesKey);
                                  } else {
                                    newExpanded.add(seriesKey);
                                  }
                                  setExpandedSeries(newExpanded);
                                }}
                                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-400 rounded-lg text-xs font-medium transition-colors"
                              >
                                {isExpanded ? '收起' : '查看场次'}
                              </button>
                            </td>
                          </tr>
                          
                          {/* 展开的场次列表 */}
                          {isExpanded && series.markets.map((market) => renderMarketRow(market))}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 最近已结算市场 */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545]">
              <h2 className="text-lg font-bold text-[#111418] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">check_circle</span>
                最近已结算 ({data.settled.total})
              </h2>
              <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">
                最近 24 小时内已结算的市场
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">市场标题</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结束时间</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结算时间</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结算类型</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结算证据</th>
                    <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {data.settled.raw.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#637588] dark:text-[#9da8b9]">
                        最近 24 小时内没有已结算的市场
                      </td>
                    </tr>
                  ) : (
                    data.settled.raw.slice(0, 20).map((market) => renderMarketRow(market, false))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
