"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface MarketTemplate {
  id: string;
  name: string;
  titleTemplate?: string | null;
  displayTemplate?: string | null; // 🔥 显示名称模板（中文模板）
  symbol: string;
  period: number;
  advanceTime: number;
  oracleUrl?: string | null;
  isActive: boolean;
  priceOffset?: number;
  status?: string;
}

export default function TemplateEditPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.template_id as string;

  const [template, setTemplate] = useState<MarketTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    titleTemplate: "",
    displayTemplate: "", // 🔥 显示名称模板（中文模板）
    symbol: "",
    period: "",
    advanceTime: "",
    oracleUrl: "",
    isActive: true,
    priceOffset: "0",
  });

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/factory/templates/${templateId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        const t = data.data;
        setTemplate(t);
        setFormData({
          name: t.name || "",
          titleTemplate: (t as any).titleTemplate || "",
          displayTemplate: (t as any).displayTemplate || "", // 🔥 显示名称模板（中文模板）
          symbol: t.symbol || "",
          period: String(t.period || ""),
          advanceTime: String(t.advanceTime || ""),
          oracleUrl: t.oracleUrl || "",
          isActive: t.isActive !== false,
          priceOffset: String((t as any).priceOffset || 0),
        });
      }
    } catch (error) {
      console.error("获取模板详情失败:", error);
      alert("获取模板详情失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/factory/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          titleTemplate: formData.titleTemplate.trim() || null,
          displayTemplate: formData.displayTemplate.trim() || null, // 🔥 显示名称模板（中文模板）
          symbol: formData.symbol.trim(),
          period: parseInt(formData.period),
          advanceTime: parseInt(formData.advanceTime),
          oracleUrl: formData.oracleUrl.trim() || null,
          isActive: formData.isActive,
          priceOffset: parseFloat(formData.priceOffset) || 0, // 🔥 行权价偏移量
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("模板更新成功");
        router.push('/admin/factory');
      } else {
        alert(data.error || "更新失败");
      }
    } catch (error) {
      console.error("更新模板失败:", error);
      alert("更新模板失败");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[800px] flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-[800px] flex flex-col items-center justify-center py-20">
        <p className="text-red-500 mb-4">模板不存在</p>
        <button
          onClick={() => router.push('/admin/factory')}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">编辑模版</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">修改模版配置和行权价偏移量</p>
        </div>
        <button
          onClick={() => router.push('/admin/factory')}
          className="px-4 py-2 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium"
        >
          返回列表
        </button>
      </div>

      {/* 编辑表单 */}
      <form onSubmit={handleSubmit} className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
        <div className="space-y-4">
          {/* 模版名称 */}
          <div>
            <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
              模版名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          {/* 标题模板（英文，可选） */}
          <div>
            <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
              标题模板（英文，可选）
            </label>
            <input
              type="text"
              name="titleTemplate"
              value={formData.titleTemplate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Will ETH be above $[StrikePrice] at [EndTime]?"
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              支持占位符: $[StrikePrice], [StrikePrice], [EndTime], [Period], [Asset], [Symbol]
            </p>
          </div>

          {/* 🔥 显示名称模板（中文，可选） */}
          <div>
            <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
              显示名称模板（中文，可选）<span className="text-blue-500 ml-1">推荐</span>
            </label>
            <input
              type="text"
              name="displayTemplate"
              value={formData.displayTemplate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="ETH 价格在 [EndTime] 是否高于 $[StrikePrice]？"
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              人工预设的中文翻译模板。工厂生成具体盘口时，会自动填入价格和时间。支持占位符: $[StrikePrice], [StrikePrice], [EndTime], [Period], [Asset], [Symbol]
            </p>
          </div>

          {/* 标的符号 */}
          <div>
            <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
              标的符号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="symbol"
              value={formData.symbol}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 周期 */}
            <div>
              <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
                周期（分钟） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="period"
                value={formData.period}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                min="1"
                required
              />
            </div>

            {/* 接力时间 */}
            <div>
              <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
                接力时间（秒）
              </label>
              <input
                type="number"
                name="advanceTime"
                value={formData.advanceTime}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                min="1"
              />
            </div>
          </div>

          {/* 🔥 行权价偏移量 */}
          <div>
            <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
              行权价偏移量
            </label>
            <input
              type="number"
              name="priceOffset"
              value={formData.priceOffset}
              onChange={handleInputChange}
              step="0.01"
              className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="0.00"
            />
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              允许运营调整盘口的博弈难度。正数表示提高行权价，负数表示降低行权价（单位：美元）
            </p>
          </div>

          {/* Oracle URL */}
          <div>
            <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
              Oracle URL（可选）
            </label>
            <input
              type="url"
              name="oracleUrl"
              value={formData.oracleUrl}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* 是否激活 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label className="ml-2 text-sm text-[#637588] dark:text-[#9da8b9]">
              激活模版
            </label>
          </div>

          {/* 提交按钮 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? '更新中...' : '保存更改'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/factory')}
              className="px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#1a2332] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
