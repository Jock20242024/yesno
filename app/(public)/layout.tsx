import { redirect } from "next/navigation";
import { auth } from "@/lib/authExport";

/**
 * 🔥 (public) 路由组布局
 * 注意：路由组布局不能包含 <html><body> 标签
 * 只有根布局（app/[locale]/layout.tsx）才能包含 <html><body>
 * 
 * 🔥 修复：检查管理员用户，如果是管理员，重定向到后台
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 🔥 修复：检查用户是否是管理员，如果是管理员，重定向到后台
  const session = await auth();
  
  if (session?.user) {
    const isAdmin = (session.user as any).isAdmin;
    // 只有明确是管理员（isAdmin === true）才重定向到后台
    if (isAdmin === true) {
      redirect("/admin/dashboard");
    }
  }
  
  // 路由组布局只返回 children，不包含 <html><body>
  return <>{children}</>;
}
