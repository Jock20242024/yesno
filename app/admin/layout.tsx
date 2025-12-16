"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  // 权限检查已移至 middleware.ts，这里只负责渲染 UI
  const handleLogout = () => {
    logout();
    // 重定向由 middleware 处理
  };

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden">
      {/* 侧边栏 */}
      <aside className="flex w-64 flex-col border-r border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark shrink-0 h-full overflow-y-auto">
        <div className="flex h-full min-h-[700px] flex-col justify-between p-4">
          <div className="flex flex-col gap-6">
            {/* Logo/标题区域 */}
            <div className="flex items-center gap-3 px-2">
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-10 bg-primary flex items-center justify-center text-white">
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>query_stats</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-[#111418] dark:text-white text-base font-bold leading-normal">预测市场后台</h1>
                <p className="text-[#637588] dark:text-[#9da8b9] text-xs font-normal leading-normal">Administrator</p>
              </div>
            </div>

            {/* 导航菜单 */}
            <div className="flex flex-col gap-2">
              <Link
                href="/admin/dashboard"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  pathname === "/admin/dashboard"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors"
                }`}
              >
                <span className="material-symbols-outlined">dashboard</span>
                <p className="text-sm font-medium leading-normal">首页概览</p>
              </Link>

              <Link
                href="/admin/users"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/users"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">group</span>
                <p className="text-sm font-medium leading-normal">用户管理</p>
              </Link>

              {/* 财务管理分组 */}
              <div className="pt-2 pb-1">
                <p className="px-3 text-xs font-bold text-[#637588] dark:text-[#58677a] uppercase tracking-wider">财务管理</p>
              </div>

              <Link
                href="/admin/deposits-withdrawals-overview"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/deposits-withdrawals-overview"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">account_balance_wallet</span>
                <p className="text-sm font-medium leading-normal">充值提现总览</p>
              </Link>

              <Link
                href="/admin/deposits"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/deposits"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">payments</span>
                <p className="text-sm font-medium leading-normal">充值管理</p>
              </Link>

              <Link
                href="/admin/withdrawals"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/withdrawals"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">move_to_inbox</span>
                <p className="text-sm font-medium leading-normal">提现管理</p>
              </Link>

              {/* 市场运营分组 */}
              <div className="pt-2 pb-1">
                <p className="px-3 text-xs font-bold text-[#637588] dark:text-[#58677a] uppercase tracking-wider">市场运营</p>
              </div>

              <Link
                href="/admin/markets/create"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/markets/create"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">add_business</span>
                <p className="text-sm font-medium leading-normal">创建市场</p>
              </Link>

              <Link
                href="/admin/markets/list"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/markets/list"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">storefront</span>
                <p className="text-sm font-medium leading-normal">市场管理</p>
              </Link>

              <Link
                href="/admin/orders"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/orders"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">list_alt</span>
                <p className="text-sm font-medium leading-normal">用户下注订单列表</p>
              </Link>

              {/* 报表与日志分组 */}
              <div className="pt-2 pb-1">
                <p className="px-3 text-xs font-bold text-[#637588] dark:text-[#58677a] uppercase tracking-wider">报表与日志</p>
              </div>

              <Link
                href="/admin/fees"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/fees"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">bar_chart</span>
                <p className="text-sm font-medium leading-normal">手续费收入报表</p>
              </Link>

              <Link
                href="/admin/logs"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname === "/admin/logs"
                    ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                    : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                }`}
              >
                <span className="material-symbols-outlined">manage_history</span>
                <p className="text-sm font-medium leading-normal">操作日志</p>
              </Link>
            </div>
          </div>

          {/* 底部设置和退出 */}
          <div className="flex flex-col gap-2 pt-4 border-t border-[#e5e7eb] dark:border-[#283545]">
            <Link
              href="/admin/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin/settings"
                  ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                  : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
              }`}
            >
              <span className="material-symbols-outlined">settings</span>
              <p className="text-sm font-medium leading-normal">系统设置</p>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#ef4444] hover:bg-[#fee2e2] dark:hover:bg-[#3f2122] transition-colors text-left w-full"
            >
              <span className="material-symbols-outlined">logout</span>
              <p className="text-sm font-medium leading-normal">退出登录</p>
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        {/* 顶部导航栏 */}
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

        {/* 主体内容 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
