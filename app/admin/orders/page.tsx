"use client";

import { useState } from "react";

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("");

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">用户下注订单列表</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看和管理所有用户的历史下注订单</p>
      </div>

      {/* 搜索和筛选区域 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card-light dark:bg-card-dark p-4 rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* 搜索框 */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>search</span>
            </div>
            <input
              className="block w-full pl-10 pr-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="搜索订单ID / 用户 / 市场..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* 时间筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="">全部时间</option>
              <option value="today">今天</option>
              <option value="week">最近7天</option>
              <option value="month">最近30天</option>
              <option value="custom">自定义范围</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>calendar_month</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 w-full lg:w-auto">
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium w-full lg:w-auto">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
            高级筛选
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium w-full lg:w-auto whitespace-nowrap">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
            导出数据
          </button>
        </div>
      </div>

      {/* 订单列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">订单ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[150px]">用户</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[250px]">市场名称</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">下注选项</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">下注金额</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">下单时间</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {/* 空状态 */}
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
                      list_alt
                    </span>
                    <div className="text-[#637588] dark:text-[#9da8b9]">
                      <p className="font-medium">暂无订单数据</p>
                      <p className="text-xs mt-1">（占位符）</p>
                    </div>
                  </div>
                </td>
              </tr>

              {/* 示例行（隐藏，展示表格结构） */}
              <tr className="hidden hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                <td className="p-4">
                  <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">#ORD-123456</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      JD
                    </div>
                    <span className="text-sm font-medium text-[#111418] dark:text-white">John Doe</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#111418] dark:text-white">2024年比特币会达到10万美元吗？</span>
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    YES
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-bold text-[#111418] dark:text-white">$100.00</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[#111418] dark:text-white">2024-01-15</span>
                    <span className="text-xs text-[#637588] dark:text-[#9da8b9]">14:30:00</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    已成交
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between p-4 border-t border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark">
          <div className="text-sm text-[#637588] dark:text-[#9da8b9]">
            显示 <span className="font-medium text-[#111418] dark:text-white">1</span> 到 <span className="font-medium text-[#111418] dark:text-white">10</span> 条，共 <span className="font-medium text-[#111418] dark:text-white">0</span> 条结果
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed">
              上一页
            </button>
            <button className="px-3 py-1 rounded border border-primary bg-primary text-sm font-medium text-white">
              1
            </button>
            <button className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]">
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
