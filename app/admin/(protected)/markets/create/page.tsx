"use client";

import { useState } from "react";

export default function MarketCreationPage() {
  const [formData, setFormData] = useState({
    marketName: "",
    description: "",
    endDate: "",
    resultOptions: "",
    feeRate: "0.05", // 默认手续费率 5%
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 将 datetime-local 格式转换为 ISO 8601 格式
      const endTime = formData.endDate ? new Date(formData.endDate).toISOString() : "";
      
      // 解析分类（这里假设 resultOptions 为 "yes-no" 时使用默认分类）
      const category = "加密货币"; // 可以根据实际需求调整
      
      const response = await fetch("/api/admin/markets", {
        method: "POST",
        headers: {
          Authorization: "Bearer ADMIN_SECRET_TOKEN",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.marketName,
          description: formData.description,
          category: category,
          endTime: endTime,
          feeRate: parseFloat(formData.feeRate) || 0.05, // 确保 feeRate 被包含在请求中
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 重置表单
        setFormData({
          marketName: "",
          description: "",
          endDate: "",
          resultOptions: "",
          feeRate: "0.05",
        });
        // 显示成功消息（可以使用 toast 或其他通知组件）
        alert("市场创建成功！");
      } else {
        alert(data.error || "创建市场失败");
      }
    } catch (error) {
      console.error("Create market error:", error);
      alert("创建市场失败");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">创建新市场</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">填写以下信息来创建一个新的预测市场</p>
      </div>

      {/* 表单容器 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 市场名称 */}
          <div>
            <label htmlFor="marketName" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              市场名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="marketName"
              name="marketName"
              value={formData.marketName}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="例如：2024年比特币会达到10万美元吗？"
              required
            />
          </div>

          {/* 描述 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              描述
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm resize-y"
              placeholder="详细描述这个预测市场的背景和相关信息..."
            />
          </div>

          {/* 截止日期 */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              截止日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              required
            />
          </div>

          {/* 结果选项 */}
          <div>
            <label htmlFor="resultOptions" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              结果选项 <span className="text-red-500">*</span>
            </label>
            <select
              id="resultOptions"
              name="resultOptions"
              value={formData.resultOptions}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              required
            >
              <option value="">请选择结果选项</option>
              <option value="yes-no">YES / NO</option>
              <option value="multiple">多选项</option>
            </select>
          </div>

          {/* 手续费率 */}
          <div>
            <label htmlFor="feeRate" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              手续费率 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="feeRate"
                name="feeRate"
                value={formData.feeRate}
                onChange={handleChange}
                min="0"
                max="1"
                step="0.01"
                className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                placeholder="例如：0.05 表示 5%"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[#637588] dark:text-[#9da8b9] text-sm">%</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              手续费率范围：0.00 - 1.00（例如：0.05 表示 5%）
            </p>
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_business</span>
              创建市场
            </button>
            <button
              type="button"
              className="px-6 py-3 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
