"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";

export default function AdminSidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/admin/login" });
  };

  return (
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

            <Link
              href="/admin/assets"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin/assets"
                  ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                  : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
              }`}
            >
              <span className="material-symbols-outlined">account_balance</span>
              <p className="text-sm font-medium leading-normal">用户资产</p>
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
              href="/admin/markets/review"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin/markets/review"
                  ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                  : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
              }`}
            >
              <span className="material-symbols-outlined">gavel</span>
              <p className="text-sm font-medium leading-normal">事件审核中心</p>
            </Link>

            <Link
              href="/admin/categories"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin/categories"
                  ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                  : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
              }`}
            >
              <span className="material-symbols-outlined">layers</span>
              <p className="text-sm font-medium leading-normal">分类管理</p>
            </Link>

            <Link
              href="/admin/stats"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin/stats"
                  ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                  : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
              }`}
            >
              <span className="material-symbols-outlined">bar_chart</span>
              <p className="text-sm font-medium leading-normal">全局指标管理</p>
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

            <Link
              href="/admin/factory"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/admin/factory"
                  ? "bg-primary text-white shadow-sm hover:bg-blue-600"
                  : "text-[#111418] dark:text-[#9da8b9] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
              }`}
            >
              <span className="material-symbols-outlined">precision_manufacturing</span>
              <p className="text-sm font-medium leading-normal">自动化工厂 (Market Factory)</p>
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
  );
}
