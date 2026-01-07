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
  // 🔥 关键修复：使用 try-catch 包裹，避免 auth() 失败导致整个页面崩溃
  try {
    const session = await auth();
    
    // 只有明确是管理员（isAdmin === true）才重定向到后台
    // 普通用户（isAdmin === false 或 undefined）可以正常访问前端
    if (session?.user) {
      const isAdmin = (session.user as any).isAdmin;
      if (isAdmin === true) {
        redirect("/admin/dashboard");
      }
    }
  } catch (authError) {
    // 🔥 修复：如果 auth() 失败，不阻止普通用户访问前端
    // 记录错误但不影响页面渲染
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [Public Layout] Auth 检查失败，允许继续访问:', authError);
    }
    // 继续执行，允许访问前端
  }
  
  // 路由组布局只返回 children，不包含 <html><body>
  return <>{children}</>;
}
