"use client";

import { useState, useEffect } from "react";
import { Plus, Play, Pause, Trash2 } from "lucide-react";

interface MarketTemplate {
  id: string;
  name: string;
  symbol: string;
  period: number;
  advanceTime: number;
  oracleUrl?: string | null;
  isActive: boolean;
  lastMarketId?: string | null;
  lastCreatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function FactoryPage() {
  const [templates, setTemplates] = useState<MarketTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    symbol: "BTC/USD",
    period: "15",
    advanceTime: "60",
    oracleUrl: "",
    isActive: true,
  });

  // 获取模板列表
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/factory/templates", {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error("获取模板列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/factory/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateForm(false);
        setFormData({
          name: "",
          symbol: "BTC/USD",
          period: "15",
          advanceTime: "60",
          oracleUrl: "",
          isActive: true,
        });
        fetchTemplates();
      } else {
        alert(data.error || "创建模板失败");
      }
    } catch (error) {
      console.error("创建模板失败:", error);
      alert("创建模板失败");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      // 这里可以添加更新 API，暂时使用刷新
      alert("切换激活状态功能待实现");
      fetchTemplates();
    } catch (error) {
      console.error("更新模板状态失败:", error);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-CN");
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">自动化工厂 (Market Factory)</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">批量创建和管理预测市场的自动化工具</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-black font-bold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建模板
        </button>
      </div>

      {/* 创建模板表单 */}
      {showCreateForm && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
          <h2 className="text-lg font-bold text-[#111418] dark:text-white mb-4">创建新模板</h2>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                模板名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
                placeholder="例如：BTC/USD 15分钟"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  标的符号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
                  placeholder="BTC/USD"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  周期（分钟） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
                  placeholder="15"
                  min="1"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                接力时间（秒）
              </label>
              <input
                type="number"
                value={formData.advanceTime}
                onChange={(e) => setFormData({ ...formData, advanceTime: e.target.value })}
                className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
                placeholder="60"
                min="1"
              />
              <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                提前多少秒创建下一期市场（默认 60 秒）
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                Oracle URL（可选）
              </label>
              <input
                type="url"
                value={formData.oracleUrl}
                onChange={(e) => setFormData({ ...formData, oracleUrl: e.target.value })}
                className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
                placeholder="https://api.coingecko.com/..."
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-black font-bold rounded-lg transition-colors"
              >
                创建模板
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#1a2332] transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 模板列表 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-bold text-[#111418] dark:text-white mb-4">模板列表</h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-[#637588] dark:text-[#9da8b9]">加载中...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-[#637588] dark:text-[#9da8b9]">
              暂无模板，点击"新建模板"创建
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e7eb] dark:border-[#283545]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">名称</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">标的</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">周期</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">接力时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">最后创建</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b border-[#e5e7eb] dark:border-[#283545] hover:bg-[#f9fafb] dark:hover:bg-[#1a2332]">
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.name}</td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.symbol}</td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.period} 分钟</td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.advanceTime} 秒</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          template.isActive 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {template.isActive ? '激活' : '停用'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#637588] dark:text-[#9da8b9]">
                        {formatDate(template.lastCreatedAt)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(template.id, template.isActive)}
                          className="text-[#637588] dark:text-[#9da8b9] hover:text-primary transition-colors"
                        >
                          {template.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
    </div>
  );
}
