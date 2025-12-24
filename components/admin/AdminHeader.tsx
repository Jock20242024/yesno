"use client";

import { usePathname } from "next/navigation";

export default function AdminHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark px-8 py-4 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#283545] cursor-pointer">
          <span className="material-symbols-outlined text-[#637588] dark:text-white">menu</span>
        </div>
        <h2 className="text-[#111418] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
          {pathname === "/admin/dashboard" && "Dashboard"}
          {pathname === "/admin/users" && "用户管理"}
          {pathname === "/admin/deposits-withdrawals-overview" && "充值提现总览"}
          {pathname === "/admin/deposits" && "充值管理"}
          {pathname === "/admin/withdrawals" && "提现管理"}
          {pathname === "/admin/markets/create" && "创建市场"}
          {pathname === "/admin/markets/list" && "市场管理"}
          {pathname === "/admin/orders" && "用户下注订单列表"}
          {pathname === "/admin/fees" && "手续费收入报表"}
          {pathname === "/admin/logs" && "操作日志"}
          {pathname === "/admin/settings" && "系统设置"}
          {pathname?.startsWith("/admin/markets/edit/") && "编辑市场"}
          {!pathname?.includes("/admin/") && "管理后台"}
        </h2>
      </div>

      <div className="flex flex-1 justify-end items-center gap-6">
        {/* 搜索框 */}
        <label className="hidden md:flex flex-col min-w-40 !h-10 max-w-64">
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full border border-[#d1d5db] dark:border-[#3e4e63] bg-white dark:bg-[#101822] overflow-hidden group focus-within:border-primary">
            <div className="text-[#637588] dark:text-[#9da8b9] flex items-center justify-center pl-3">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 bg-transparent h-full placeholder:text-[#9da8b9] px-2 text-sm font-normal leading-normal"
              placeholder="搜索订单号 / 用户名..."
            />
          </div>
        </label>

        {/* 右侧按钮组 - 已删除头像、通知、设置图标 */}
      </div>
    </header>
  );
}
