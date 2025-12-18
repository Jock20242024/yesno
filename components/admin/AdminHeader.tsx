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

        {/* 右侧按钮组 */}
        <div className="flex gap-2 items-center">
          <button className="relative flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full hover:bg-gray-100 dark:hover:bg-[#283545] transition-colors text-[#111418] dark:text-white">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2.5 right-2.5 size-2 bg-[#ef4444] rounded-full border-2 border-white dark:border-[#18232e]"></span>
          </button>

          <button className="flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full hover:bg-gray-100 dark:hover:bg-[#283545] transition-colors text-[#111418] dark:text-white">
            <span className="material-symbols-outlined">settings</span>
          </button>

          {/* 用户头像 */}
          <div
            className="ml-2 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-[#e5e7eb] dark:border-[#283545]"
            style={{
              backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuALmRVENrtdE1njVcx1VImuNtzXFRvmlupCLSjoRbMbecRMZXkGgAwrhy7WtgrOexqJ8sGqwN8i_yAOLzmYUnvlSwVvLB7v_EBy7pR_J-DcCpz_ZcTG-1J8l8-ukBBexR9G7gEOOtKu3BAu4ywlBf2a1V6C80Xs-tjOc8y8qwYJuQo5yQFZybIBTLp6ki1IThyyJX9loXTSctcvc2WPZbdFECyFFtOp5C7pFATu3iwjgM8QEcKUzWOXIljYN1HSQs2hrfrX3n8IZkQ")`,
            }}
          />
        </div>
      </div>
    </header>
  );
}
