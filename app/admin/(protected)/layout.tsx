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
  // 🔥 布局组件"终极审判"：这是最后一道防线
  // 逻辑：获取 session。只有当明确 session.user 存在且 session.user.isAdmin === false 时，才执行重定向到 /
  // 关键：如果 session 还没加载出来，显示一个 Loading... 界面，绝对不要跳转

  // 权限检查：必须使用服务器端会话验证
  const session = await auth();

  // 🛡️ 权限锁：页面级防御 - 确保管理员后台的 Layout 逻辑是最终防线
  // 🛡️ 监控：保留我们之前的 🛡️ [Admin-Layout] 日志，直到测试完全通过
  console.log('🛡️ [Admin-Layout] 权限检查:', session?.user);

  // 情况 A: 如果用户未登录，重定向到 admin 登录页
  if (!session || !session.user) {
    // 🛡️ 强制"打桩"监控：在执行 redirect 之前，打印 Session 数据
    console.log('🛡️ [Admin-Layout] 拦截检查 - Session 数据:', JSON.stringify(session?.user));
    console.log('🛡️ [Admin-Layout] 重定向到 /admin/login（管理员登录页）');
    // 🔥 修复：确保重定向到管理员登录页，而不是用户登录页
    redirect("/admin/login");
  }
  
  // 🔥 布局组件"终极审判"：只有当明确 session.user.isAdmin === false 时，才执行重定向
  // 🔥 关键修复：非管理员用户应该重定向到 /admin/login，而不是首页，避免误跳转到用户登录页
  const isAdmin = (session.user as any).isAdmin;
  
  if (isAdmin === false) {
    // 🔥 明确是 false，重定向到管理员登录页，而不是首页（避免误跳到用户登录页）
    console.log('🛡️ [Admin-Layout] 权限拦截：已登录但明确不是管理员（isAdmin === false），重定向到管理员登录页', {
      email: session.user.email,
      isAdmin: isAdmin,
    });
    redirect("/admin/login");
  }

  // 如果 isAdmin 为 undefined，说明权限状态未确定，显示 Loading 界面
  // 🔥 注意：不要在 isAdmin 为 undefined 时重定向，因为这可能是 session 正在加载
  if (isAdmin === undefined) {
    console.log('🛡️ [Admin-Layout] 权限状态未确定（isAdmin === undefined），显示 Loading 界面');
    return (
      <div className="relative flex h-screen w-full flex-row overflow-hidden items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  console.log('🛡️ [Admin-Layout] 权限验证通过：允许渲染管理员页面', {
    email: session.user.email,
    isAdmin: isAdmin,
  });

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
