"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTemplateModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTemplateModalProps) {
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [formData, setFormData] = useState({
    name: "", // 🔥 手动标题字段
    titleTemplate: "Will BTC be above $[StrikePrice] at [EndTime]?",
    displayTemplate: "", // 🔥 显示名称模板（中文模板）
    symbol: "BTC/USD",
    period: "15",
    categorySlug: "crypto",
    advanceTime: "120",
    priceOffset: "0",
    externalIdPattern: "",
    oracleUrl: "",
    isActive: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories", {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        // 只显示加密货币和金融分类
        const filteredCategories = data.data
          .filter((cat: any) => cat.slug === 'crypto' || cat.slug === 'finance')
          .map((cat: any) => ({ id: cat.id, name: cat.name, slug: cat.slug }));
        setCategories(filteredCategories);
      }
    } catch (error) {
      console.error("获取分类列表失败:", error);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🔥 验证必填字段
    if (!formData.name || !formData.name.trim()) {
      alert("请填写模版名称！");
      return;
    }
    if (!formData.symbol || !formData.symbol.trim()) {
      alert("请填写标的符号！");
      return;
    }
    
    try {
      const response = await fetch("/api/admin/factory/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(), // 🔥 使用 name 字段（必填）
          nameZh: null, // 🔥 中文名称（可选）
          titleTemplate: formData.titleTemplate || null, // 🔥 标题模板（可选）
          displayTemplate: formData.displayTemplate || null, // 🔥 显示名称模板（可选）
          symbol: formData.symbol.trim(), // 🔥 标的符号（必填）
          period: formData.period, // 🔥 传递字符串，API 会进行 Number() 转型
          categorySlug: formData.categorySlug || null, // 🔥 分类 slug
          advanceTime: formData.advanceTime || "120", // 🔥 传递字符串，API 会进行 Number() 转型
          externalIdPattern: formData.externalIdPattern || null,
          oracleUrl: formData.oracleUrl || null,
          isActive: formData.isActive,
          // 🔥 注意：不要传 priceOffset，Schema 中没有这个字段
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 重置表单
        setFormData({
          name: "",
          titleTemplate: "Will BTC be above $[StrikePrice] at [EndTime]?",
          displayTemplate: "",
          symbol: "BTC/USD",
          period: "15",
          categorySlug: "crypto",
          advanceTime: "120",
          priceOffset: "0",
          externalIdPattern: "",
          oracleUrl: "",
          isActive: true,
        });
        alert("模板创建成功！");
        onSuccess();
        onClose();
      } else {
        alert(data.error || "创建模板失败");
      }
    } catch (error: any) {
      console.error("创建模板失败:", error);
      alert(`创建模板失败: ${error.message || '未知错误'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        // 🔥 点击背景关闭模态框
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 🔥 提高 z-index 到 99999，确保模态框在错误弹窗之上 */}
      <div 
        className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()} // 阻止点击事件冒泡
      >
        {/* Dialog 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb] dark:border-[#283545]">
          <h2 className="text-xl font-bold text-[#111418] dark:text-white flex items-center gap-2">
            <Plus className="w-5 h-5" />
            创建新模板
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#1a2332] text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dialog 内容 */}
        <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
          {/* 🔥 模版名称（手动标题） */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              模版名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              placeholder="BTC 价格在 [StartTime] - [EndTime] 期间是否高于 $[StrikePrice]？"
              required
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              工厂生成新盘口时，标题将完全等于这里手动写的名字（支持占位符）
            </p>
          </div>

          {/* 标题模板（英文，可选） */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              标题模板（英文，可选）
            </label>
            <input
              type="text"
              value={formData.titleTemplate}
              onChange={(e) => setFormData({ ...formData, titleTemplate: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              placeholder="Will BTC be above $[StrikePrice] at [EndTime]?"
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              支持占位符: $[StrikePrice], [StrikePrice], [EndTime], [StartTime], [Period], [Asset], [Symbol]
            </p>
          </div>

          {/* 🔥 显示名称模板（中文，可选） */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              显示名称模板（中文，可选）<span className="text-blue-500 ml-1">推荐</span>
            </label>
            <input
              type="text"
              value={formData.displayTemplate}
              onChange={(e) => setFormData({ ...formData, displayTemplate: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              placeholder="BTC 价格在 [StartTime] - [EndTime] 期间是否高于 $[StrikePrice]？"
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              人工预设的中文翻译模板。支持占位符: $[StrikePrice], [StrikePrice], [StartTime], [EndTime], [Period], [Asset], [Symbol]
            </p>
          </div>

          {/* 🔥 标的符号输入框 */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              标的符号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              placeholder="BTC/USD 或 ETH/USD"
              required
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              标的资产符号，如 BTC/USD、ETH/USD 等
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              关联分类 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.categorySlug}
              onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              required
            >
              {categories && categories.length > 0 ? (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="crypto">加密货币</option>
                  <option value="finance">金融</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              接力周期 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              required
            >
              <option value="15">15分钟 (15m)</option>
              <option value="60">1小时 (1h)</option>
              <option value="240">4小时 (4h)</option>
              <option value="1440">1天 (1d)</option>
              <option value="10080">1周 (1w)</option>
              <option value="43200">1月 (1M)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              行权价偏移量（美元）
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.priceOffset}
              onChange={(e) => setFormData({ ...formData, priceOffset: e.target.value })}
              className="block w-full px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              正数提高行权价，负数降低行权价（默认 0）
            </p>
          </div>

          {/* Dialog 底部按钮 - 🔥 使用 sticky 定位确保按钮始终可见，提高 z-index */}
          <div className="sticky bottom-0 bg-card-light dark:bg-card-dark pt-4 pb-4 -mx-6 px-6 border-t border-[#e5e7eb] dark:border-[#283545] flex items-center justify-end gap-4 z-[999999]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#1a2332] transition-colors font-medium relative z-[999999]"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-black font-bold rounded-lg transition-colors relative z-[999999]"
            >
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
