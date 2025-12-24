"use client";

// 🚀 第二步：工厂市场列表 Tab 组件
// 复用 MarketsListPage 的逻辑，但传入 source='factory'

import { useState, useMemo, useEffect } from "react";
import { useAdminMarkets } from "@/hooks/useAdminData";
import MarketTable from "@/app/admin/markets/components/MarketTable";

export default function FactoryMarketsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [showHistorical, setShowHistorical] = useState<Record<string, boolean>>({});
  const limit = 10;

  // 🚀 第二步：传入 source='factory' 参数
  const { markets, isLoading, error, pagination } = useAdminMarkets({
    search: searchQuery,
    status: statusFilter,
    page: currentPage,
    limit: limit,
    showDetails: showDetails,
    source: 'factory', // 🚀 第二步：只显示工厂市场
  });

  // 🚀 获取模板列表（用于计算总场次数）
  const [templates, setTemplates] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/admin/factory/templates", {
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success) {
          setTemplates(data.data);
        }
      } catch (error) {
        console.error("获取模板列表失败:", error);
      }
    };
    fetchTemplates();
  }, []);
  
  // 🚀 计算总场次数的函数（工厂模式专用）
  // 🚀 修复：宽窗口是36小时，不是24小时
  const getTotalSlots = useMemo(() => {
    const templateMap = new Map(templates.map((t: any) => [t.id, t.period]));
    return (templateId: string) => {
      const period = templateMap.get(templateId);
      if (!period) return 144; // 默认 144（15m，36小时）
      // 🚀 宽窗口：36小时（向前12小时 + 向后24小时）
      // 15分钟 = 144个场次（36小时 * 4 = 144）
      // 1小时 = 36个场次（36小时 * 1 = 36）
      // 4小时 = 9个场次（36小时 / 4 = 9）
      // 1天 = 1.5个场次，向上取整为2（但实际应该是1或2，取决于窗口）
      if (period === 15) return 144; // 36小时 * 4
      if (period === 60) return 36;  // 36小时 * 1
      if (period === 240) return 9;  // 36小时 / 4，向上取整
      if (period === 1440) return 2; // 36小时 / 24，向上取整
      // 其他周期：36小时 / 周期（小时），向上取整
      return Math.ceil(36 * 60 / period);
    };
  }, [templates]);

  // 处理展开/收起
  const handleToggleExpand = (seriesKey: string) => {
    const newExpanded = new Set(expandedSeries);
    if (newExpanded.has(seriesKey)) {
      newExpanded.delete(seriesKey);
    } else {
      newExpanded.add(seriesKey);
    }
    setExpandedSeries(newExpanded);
  };

  // 处理历史记录显示
  const handleToggleHistorical = (seriesKey: string) => {
    setShowHistorical(prev => ({
      ...prev,
      [seriesKey]: !prev[seriesKey]
    }));
  };

  // 处理搜索输入变化（防抖）
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理状态筛选变化
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 处理删除市场
  const handleDeleteMarket = async (marketId: string, marketTitle: string) => {
    const confirmed = window.confirm(`确定要删除市场 "${marketTitle}" 吗？\n\n此操作将隐藏该市场，用户将无法再看到它。`);
    
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/markets/${marketId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('市场已成功删除');
        window.location.reload();
      } else {
        alert(`删除失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除市场失败:', error);
      alert('删除失败，请稍后重试');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 搜索和筛选区域 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card-light dark:bg-card-dark p-4 rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* 下钻功能切换按钮 */}
          <button
            onClick={() => {
              setShowDetails(!showDetails);
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              showDetails
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {showDetails ? "显示聚合视图" : "显示详细场次"}
          </button>
          {/* 搜索框 */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>search</span>
            </div>
            <input
              className="block w-full pl-10 pr-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="搜索市场ID / 标题..."
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          {/* 状态筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="">所有状态</option>
              <option value="open">进行中</option>
              <option value="closed">已关闭</option>
              <option value="pending">待结算</option>
              <option value="resolved">已结算</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>expand_more</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 使用 MarketTable 组件（mode='factory'） */}
      <MarketTable
        markets={markets}
        isLoading={isLoading}
        error={error}
        pagination={pagination}
        mode="factory"
        showDetails={showDetails}
        expandedSeries={expandedSeries}
        showHistorical={showHistorical}
        onToggleExpand={handleToggleExpand}
        onToggleHistorical={handleToggleHistorical}
        onPageChange={handlePageChange}
        onDeleteMarket={handleDeleteMarket}
        getTotalSlots={getTotalSlots}
      />
    </div>
  );
}
