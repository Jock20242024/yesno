import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/authExport";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export const dynamic = "force-dynamic";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // 🔥 修复：明确检查 isAdmin === true 才允许访问后台
  // 关键：只有明确是管理员（isAdmin === true）才允许访问，其他情况一律重定向

  // 权限检查：必须使用服务器端会话验证
  const session = await auth();

  // 🛡️ 权限锁：页面级防御 - 确保管理员后台的 Layout 逻辑是最终防线

  // 情况 A: 如果用户未登录，重定向到 admin 登录页
  if (!session || !session.user) {
    redirect("/admin/login");
  }
  
  // 🔥 修复：明确检查 isAdmin === true，只有管理员才能访问
  const isAdmin = (session.user as any).isAdmin;
  
  // 🔥 关键修复：只有 isAdmin === true 才允许访问，其他所有情况（false、undefined、null）都重定向
  if (isAdmin !== true) {
    // 非管理员用户或权限未确定，重定向到管理员登录页
    redirect("/admin/login");
  }

  // 情况 B: 是管理员（isAdmin === true），正常渲染 children

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden">
      {/* 侧边栏 */}
      <AdminSidebar />

      {/* 主内容区域 */}
      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        {/* 顶部导航栏 */}
        <AdminHeader />

        {/* 主体内容 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
