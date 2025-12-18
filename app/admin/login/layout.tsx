import { ReactNode } from "react";

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  // 登录页面不需要 sidebar 和 header，直接渲染 children
  return <>{children}</>;
}
