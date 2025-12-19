"use client";

import { useState, useEffect } from "react";
import { X, Edit2, Trash2, Plus, RefreshCw, Play, Loader2 } from "lucide-react";

interface GlobalStat {
  id: string;
  label: string;
  value: number;
  unit: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DataSource {
  id: string;
  sourceName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastSyncTime: string | null;
  itemsCount: number;
  multiplier: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function StatsManagementPage() {
  const [stats, setStats] = useState<GlobalStat[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStat, setEditingStat] = useState<GlobalStat | null>(null);
  const [runningScraper, setRunningScraper] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    value: "",
    unit: "",
    icon: "",
    sortOrder: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取指标列表
  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/stats", {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error("获取指标列表失败");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("获取指标列表失败:", error);
      alert("获取指标列表失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 获取采集源列表
  const fetchDataSources = async () => {
    try {
      const response = await fetch("/api/admin/scrapers", {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error("获取采集源列表失败");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setDataSources(data.data);
      }
    } catch (error) {
      console.error("获取采集源列表失败:", error);
    }
  };

  // 手动运行采集
  const handleRunScraper = async (sourceName: string) => {
    try {
      setRunningScraper(sourceName);
      
      const response = await fetch(`/api/admin/scrapers/${sourceName}/run`, {
        method: "POST",
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${result.message}`);
        // 刷新采集源列表
        await fetchDataSources();
        // 刷新指标列表（因为可能更新了 GlobalStat）
        await fetchStats();
      } else {
        alert(`❌ 采集失败: ${result.error}`);
      }
    } catch (error) {
      console.error("运行采集失败:", error);
      alert("运行采集失败，请稍后重试");
    } finally {
      setRunningScraper(null);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDataSources();
  }, []);

  // 打开编辑对话框
  const handleEditClick = (stat: GlobalStat) => {
    setEditingStat(stat);
    setFormData({
      label: stat.label,
      value: stat.value.toString(),
      unit: stat.unit || "",
      icon: stat.icon || "",
      sortOrder: stat.sortOrder.toString(),
      isActive: stat.isActive,
    });
    setIsDialogOpen(true);
  };

  // 打开新建对话框
  const handleAddClick = () => {
    setEditingStat(null);
    setFormData({
      label: "",
      value: "",
      unit: "",
      icon: "",
      sortOrder: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStat(null);
    setFormData({
      label: "",
      value: "",
      unit: "",
      icon: "",
      sortOrder: "",
      isActive: true,
    });
  };

  // 处理提交（新建或编辑）
  const handleSubmit = async () => {
    if (!formData.label.trim()) {
      alert("指标名称不能为空");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingStat
        ? `/api/admin/stats/${editingStat.id}`
        : "/api/admin/stats";
      const method = editingStat ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          label: formData.label.trim(),
          value: formData.value ? parseFloat(formData.value) : 0,
          unit: formData.unit || null,
          icon: formData.icon || null,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder) : 0,
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchStats();
        handleCloseDialog();
        alert(editingStat ? "指标更新成功！" : "指标创建成功！");
      } else {
        alert(data.error || "操作失败，请稍后重试");
      }
    } catch (error) {
      console.error("操作失败:", error);
      alert("操作失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除
  const handleDelete = async (statId: string) => {
    if (!confirm("确定要删除这个指标吗？删除后无法恢复。")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/stats/${statId}`, {
        method: "DELETE",
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        await fetchStats();
        alert("指标删除成功！");
      } else {
        alert(data.error || "删除失败，请稍后重试");
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败，请稍后重试");
    }
  };

  // 获取状态显示样式
  const getStatusDisplay = (isActive: boolean) => {
    if (isActive) {
      return {
        text: "启用",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      };
    } else {
      return {
        text: "禁用",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      };
    }
  };

  // 图标选项
  const iconOptions = [
    { value: "DollarSign", label: "DollarSign (美元)" },
    { value: "Activity", label: "Activity (活动)" },
    { value: "TrendingUp", label: "TrendingUp (趋势)" },
    { value: "Users", label: "Users (用户)" },
    { value: "BarChart", label: "BarChart (图表)" },
    { value: "LineChart", label: "LineChart (折线图)" },
  ];

  // 格式化最后同步时间
  const formatLastSyncTime = (timeString: string | null) => {
    if (!timeString) return '从未同步';
    const date = new Date(timeString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-500 dark:text-green-400';
      case 'INACTIVE':
        return 'text-gray-500 dark:text-gray-400';
      case 'ERROR':
        return 'text-red-500 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 采集源监控表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#111418] dark:text-white mb-2">数据采集源监控</h2>
              <p className="text-sm text-[#637588] dark:text-[#9da8b9]">实时监控各采集源的运行状态和同步情况</p>
            </div>
            <button
              onClick={fetchDataSources}
              className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              刷新状态
            </button>
          </div>

          {dataSources.length === 0 ? (
            <div className="text-center py-8 text-[#637588] dark:text-[#9da8b9]">
              暂无采集源配置
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb] dark:border-[#283545]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                      采集源名称
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                      最后同步时间
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                      采集数量
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                      权重系数
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
                  {dataSources.map((source) => (
                    <tr key={source.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#283545] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#111418] dark:text-white">{source.sourceName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${getStatusColor(source.status)}`}>
                          {source.status === 'ACTIVE' ? '激活' : 
                           source.status === 'INACTIVE' ? '停用' : '错误'}
                        </span>
                        {source.status === 'ERROR' && source.errorMessage && (
                          <div className="text-xs text-red-500 dark:text-red-400 mt-1 truncate max-w-xs">
                            {source.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#637588] dark:text-[#9da8b9]">
                        {formatLastSyncTime(source.lastSyncTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#111418] dark:text-white">
                        {source.itemsCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#111418] dark:text-white">
                        {source.multiplier.toFixed(2)}x
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRunScraper(source.sourceName)}
                          disabled={runningScraper === source.sourceName}
                          className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {runningScraper === source.sourceName ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              抓取中...
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              手动运行
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 页面标题和操作按钮 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">全局指标管理</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">管理数据中心页面显示的全局指标</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          添加新指标
        </button>
      </div>

      {/* 指标列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f3f4f6] dark:bg-[#1a2332] border-b border-[#e5e7eb] dark:border-[#283545]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  指标名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  数值
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  单位
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  图标
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  排序
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#637588] dark:text-[#9da8b9]">
                    加载中...
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#637588] dark:text-[#9da8b9]">
                    暂无指标数据，点击"添加新指标"创建第一个指标
                  </td>
                </tr>
              ) : (
                stats.map((stat) => {
                  const statusDisplay = getStatusDisplay(stat.isActive);
                  return (
                    <tr
                      key={stat.id}
                      className="hover:bg-[#f9fafb] dark:hover:bg-[#283545] transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[#111418] dark:text-white">
                          {stat.label}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {stat.value.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {stat.unit || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {stat.icon || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {stat.sortOrder}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}
                        >
                          {statusDisplay.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditClick(stat)}
                          className="text-primary hover:text-blue-600 mr-4 flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(stat.id)}
                          className="text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加/编辑指标对话框 */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            {/* 对话框头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb] dark:border-[#283545] sticky top-0 bg-card-light dark:bg-card-dark">
              <h2 className="text-xl font-bold text-[#111418] dark:text-white">
                {editingStat ? "编辑指标" : "添加新指标"}
              </h2>
              <button
                onClick={handleCloseDialog}
                className="text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 对话框内容 */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  指标名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="例如：24H 交易量"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  数值
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  单位
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="例如：USD, %, 人"
                />
                <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                  留空则不显示单位
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  图标名称
                </label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                >
                  <option value="">无</option>
                  {iconOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                  选择用于显示的图标
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  显示排序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="数字越小越靠前"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  状态
                </label>
                <select
                  value={formData.isActive ? "true" : "false"}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "true" })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                >
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </div>
            </div>

            {/* 对话框底部按钮 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e5e7eb] dark:border-[#283545]">
              <button
                onClick={handleCloseDialog}
                className="px-4 py-2 text-sm font-medium text-[#111418] dark:text-white bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "提交中..." : editingStat ? "更新" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
