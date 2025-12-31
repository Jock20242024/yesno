/**
 * 🔥 (public) 路由组布局
 * 注意：路由组布局不能包含 <html><body> 标签
 * 只有根布局（app/[locale]/layout.tsx）才能包含 <html><body>
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 路由组布局只返回 children，不包含 <html><body>
  return <>{children}</>;
}
