"use client";

import { useState, useEffect } from "react";
import { useAdminMarkets } from "@/hooks/useAdminData";
import { usePendingWithdrawals } from "@/hooks/useAdminData";
import { MarketStatus } from "@/types/data";
// import { toast } from "sonner"; // 已移除 sonner 依赖
import { Loader2 } from "lucide-react";

const ADMIN_SECRET_TOKEN = "ADMIN_SECRET_TOKEN";

export default function AdminDashboardPage() {
  const [feeTimeRange, setFeeTimeRange] = useState<"today" | "week" | "month">("today");
  const [transactionTimeRange, setTransactionTimeRange] = useState<"day" | "week" | "month" | "year">("month");
  const [userTimeRange, setUserTimeRange] = useState<"day" | "week" | "month" | "year">("week");
  const [marketTimeRange, setMarketTimeRange] = useState<"day" | "week" | "month" | "year">("day");

  return (
    <div className="mx-auto max-w-[1200px] flex flex-col gap-8 pb-10">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">总交易量</p>
            <span className="material-symbols-outlined text-primary">bar_chart</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight">$4,291,000</p>
          </div>
          <p className="text-[#0bda5e] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            +12.5% 本周
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">活跃用户 (24h)</p>
            <span className="material-symbols-outlined text-primary">group</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight">1,240</p>
          </div>
          <p className="text-[#0bda5e] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            +5.2% 较昨日
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-[#fa6238]"></div>
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">待处理提现</p>
            <span className="material-symbols-outlined text-[#fa6238]">warning</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight">15</p>
            <span className="text-xs text-[#637588] dark:text-[#9da8b9]">笔申请</span>
          </div>
          <p className="text-[#fa6238] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
            需要尽快处理
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">今日手续费收入</p>
            <span className="material-symbols-outlined text-primary">attach_money</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight">$3,400</p>
          </div>
          <p className="text-[#0bda5e] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            +8.1%
          </p>
        </div>
      </div>

      {/* 手续费收入趋势和待办事项 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 手续费收入趋势 */}
        <div className="flex flex-1 flex-col rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">手续费收入趋势</h3>
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">平台总收益可视化分析</p>
            </div>
            <div className="flex items-center p-1 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg">
              <button
                onClick={() => setFeeTimeRange("today")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  feeTimeRange === "today"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                今日
              </button>
              <button
                onClick={() => setFeeTimeRange("week")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  feeTimeRange === "week"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                本周
              </button>
              <button
                onClick={() => setFeeTimeRange("month")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  feeTimeRange === "month"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                本月
              </button>
            </div>
          </div>
          <div className="w-full h-[280px] relative">
            <svg className="overflow-visible" fill="none" height="100%" preserveAspectRatio="none" viewBox="0 0 800 250" width="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#136dec" stopOpacity="0.2"></stop>
                  <stop offset="100%" stopColor="#136dec" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="200" y2="200"></line>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="150" y2="150"></line>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="100" y2="100"></line>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="50" y2="50"></line>
              <path d="M0 200 L0 150 C50 150 50 80 100 80 C150 80 150 120 200 120 C250 120 250 60 300 60 C350 60 350 100 400 100 C450 100 450 40 500 40 C550 40 550 90 600 90 C650 90 650 130 700 130 C750 130 750 20 800 20 L800 200 Z" fill="url(#chartGradient)"></path>
              <path d="M0 150 C50 150 50 80 100 80 C150 80 150 120 200 120 C250 120 250 60 300 60 C350 60 350 100 400 100 C450 100 450 40 500 40 C550 40 550 90 600 90 C650 90 650 130 700 130 C750 130 750 20 800 20" fill="none" stroke="#136dec" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
              <circle cx="800" cy="20" fill="#136dec" r="5" stroke="white" strokeWidth="2"></circle>
            </svg>
            <div className="absolute top-2 right-0 bg-[#111418] text-white text-xs px-2 py-1 rounded opacity-80 shadow-lg">
              $1,240 (Now)
            </div>
          </div>
          <div className="flex justify-between mt-4 px-2">
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">00:00</span>
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">04:00</span>
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">08:00</span>
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">12:00</span>
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">16:00</span>
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">20:00</span>
            <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">23:59</span>
          </div>
        </div>

        {/* 待办事项和系统状态 */}
        <div className="flex lg:w-80 flex-col gap-4">
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6 flex flex-col gap-4 flex-1">
            <h3 className="text-[#111418] dark:text-white text-base font-bold">待办事项</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#f9fafb] dark:bg-[#101822]">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-[#fa6238]/10 flex items-center justify-center text-[#fa6238]">
                    <span className="material-symbols-outlined text-sm">priority_high</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[#111418] dark:text-white">大额提现审核</span>
                    <span className="text-xs text-[#637588] dark:text-[#9da8b9]">2 笔 &gt; $10,000</span>
                  </div>
                </div>
                <button className="text-xs font-bold text-primary hover:text-blue-400">处理</button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#f9fafb] dark:bg-[#101822]">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-sm">person_add</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[#111418] dark:text-white">新用户KYC</span>
                    <span className="text-xs text-[#637588] dark:text-[#9da8b9]">12 位待审核</span>
                  </div>
                </div>
                <button className="text-xs font-bold text-primary hover:text-blue-400">查看</button>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-primary to-[#0e4b9e] text-white shadow-sm p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined">dns</span>
              <h3 className="text-base font-bold">系统状态</h3>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="opacity-80">Oracle连接</span>
              <span className="font-bold text-[#0bda5e]">正常</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="opacity-80">区块同步</span>
              <span className="font-bold text-[#0bda5e]">100%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="opacity-80">API延迟</span>
              <span className="font-bold">24ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* 总交易量和总注册用户数 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 总交易量 */}
        <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col">
          <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">总交易量</h3>
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">平台总交易金额趋势分析</p>
            </div>
            <div className="flex items-center p-1 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg">
              <button
                onClick={() => setTransactionTimeRange("day")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  transactionTimeRange === "day"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                日
              </button>
              <button
                onClick={() => setTransactionTimeRange("week")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  transactionTimeRange === "week"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                周
              </button>
              <button
                onClick={() => setTransactionTimeRange("month")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  transactionTimeRange === "month"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                月
              </button>
              <button
                onClick={() => setTransactionTimeRange("year")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  transactionTimeRange === "year"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                年
              </button>
            </div>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#111418] dark:text-white tracking-tight">$42.9M</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0bda5e] bg-[#0bda5e]/10 px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  +8.4%
                </span>
              </div>
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm">累计总交易额</p>
            </div>
            <div className="h-[200px] w-full relative">
              <svg className="overflow-visible w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="transactionGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#136dec" stopOpacity="0.25"></stop>
                    <stop offset="100%" stopColor="#136dec" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
                <path d="M0 160 L0 120 C50 120 50 80 100 70 C150 60 200 100 250 80 C300 60 350 40 400 50 C450 60 500 20 550 10 C600 0 650 30 700 20 C750 10 750 -20 800 -30 L800 200 L0 200 Z" fill="url(#transactionGradient)"></path>
                <path d="M0 120 C50 120 50 80 100 70 C150 60 200 100 250 80 C300 60 350 40 400 50 C450 60 500 20 550 10 C600 0 650 30 700 20 C750 10 750 -20 800 -30" fill="none" stroke="#136dec" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* 总注册用户数 */}
        <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col">
          <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">总注册用户数</h3>
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">平台用户增长趋势分析</p>
            </div>
            <div className="flex items-center p-1 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg">
              <button
                onClick={() => setUserTimeRange("day")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  userTimeRange === "day"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                日
              </button>
              <button
                onClick={() => setUserTimeRange("week")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  userTimeRange === "week"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                周
              </button>
              <button
                onClick={() => setUserTimeRange("month")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  userTimeRange === "month"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                月
              </button>
              <button
                onClick={() => setUserTimeRange("year")}
                className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                  userTimeRange === "year"
                    ? "text-white bg-primary"
                    : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
                }`}
              >
                年
              </button>
            </div>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#111418] dark:text-white tracking-tight">8,542</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0bda5e] bg-[#0bda5e]/10 px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  +12.5%
                </span>
              </div>
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm">当前总注册用户</p>
            </div>
            <div className="h-[200px] w-full relative">
              <svg className="overflow-visible w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="userGrowthGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#136dec" stopOpacity="0.25"></stop>
                    <stop offset="100%" stopColor="#136dec" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
                <path d="M0 180 L0 140 C100 130 150 120 200 110 C300 90 350 100 400 80 C500 40 550 50 600 20 C700 -40 750 -30 800 -50 L800 200 L0 200 Z" fill="url(#userGrowthGradient)"></path>
                <path d="M0 140 C100 130 150 120 200 110 C300 90 350 100 400 80 C500 40 550 50 600 20 C700 -40 750 -30 800 -50" fill="none" stroke="#136dec" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 活跃市场数量 */}
      <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col mt-6">
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">活跃市场数量</h3>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">平台活跃市场趋势分析</p>
          </div>
          <div className="flex items-center p-1 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg">
            <button
              onClick={() => setMarketTimeRange("day")}
              className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                marketTimeRange === "day"
                  ? "text-white bg-primary"
                  : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
              }`}
            >
              日
            </button>
            <button
              onClick={() => setMarketTimeRange("week")}
              className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                marketTimeRange === "week"
                  ? "text-white bg-primary"
                  : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
              }`}
            >
              周
            </button>
            <button
              onClick={() => setMarketTimeRange("month")}
              className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                marketTimeRange === "month"
                  ? "text-white bg-primary"
                  : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
              }`}
            >
              月
            </button>
            <button
              onClick={() => setMarketTimeRange("year")}
              className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
                marketTimeRange === "year"
                  ? "text-white bg-primary"
                  : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
              }`}
            >
              年
            </button>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="flex flex-col gap-6 justify-center">
            <div className="flex flex-col gap-2">
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium">当前活跃市场</p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-[#111418] dark:text-white tracking-tight">432</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0bda5e] bg-[#0bda5e]/10 px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  +3.8%
                </span>
                <span className="text-sm text-[#637588] dark:text-[#9da8b9]">较昨日</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#f9fafb] dark:bg-[#101822] border border-[#e5e7eb] dark:border-[#283545]">
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-1">今日新增市场</p>
                <p className="text-xl font-bold text-[#111418] dark:text-white">+14</p>
              </div>
              <div className="p-4 rounded-lg bg-[#f9fafb] dark:bg-[#101822] border border-[#e5e7eb] dark:border-[#283545]">
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-1">即将结束市场</p>
                <p className="text-xl font-bold text-[#111418] dark:text-white">8</p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 h-[320px] relative">
            <svg className="overflow-visible w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="activeMarketGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#136dec" stopOpacity="0.25"></stop>
                  <stop offset="100%" stopColor="#136dec" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="250" y2="250"></line>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="190" y2="190"></line>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="130" y2="130"></line>
              <line stroke="#e5e7eb" strokeOpacity="0.2" strokeWidth="1" x1="0" x2="800" y1="70" y2="70"></line>
              <path d="M0 200 L0 180 C100 190 150 160 200 150 C300 130 350 150 400 130 C500 100 550 110 600 80 C700 50 750 40 800 50 L800 250 Z" fill="url(#activeMarketGradient)"></path>
              <path d="M0 180 C100 190 150 160 200 150 C300 130 350 150 400 130 C500 100 550 110 600 80 C700 50 750 40 800 50" fill="none" stroke="#136dec" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
              <circle cx="800" cy="50" fill="#136dec" r="6" stroke="white" strokeWidth="2"></circle>
              <circle cx="600" cy="80" fill="#136dec" r="4" stroke="white" strokeWidth="2"></circle>
              <circle cx="400" cy="130" fill="#136dec" r="4" stroke="white" strokeWidth="2"></circle>
              <circle cx="200" cy="150" fill="#136dec" r="4" stroke="white" strokeWidth="2"></circle>
            </svg>
            <div className="flex justify-between mt-2 px-1 w-full">
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">00:00</span>
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">04:00</span>
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">08:00</span>
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">12:00</span>
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">16:00</span>
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">20:00</span>
              <span className="text-xs font-medium text-[#637588] dark:text-[#9da8b9]">23:59</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
