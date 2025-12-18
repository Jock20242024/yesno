import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export const dynamic = "force-dynamic";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // 权限检查：必须使用服务器端会话验证
  const session = await auth();

  // 情况 A: 如果用户未登录，重定向到 admin 登录页
  if (!session || !session.user) {
    redirect("/admin/login");
  }

  // 情况 B: 如果已登录但不是管理员，重定向到首页
  if (!session.user.isAdmin) {
    redirect("/");
  }

  // 情况 C: 是管理员，正常渲染 children

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
