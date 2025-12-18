/**
 * 全局 404 页面
 * 架构加固：不包含 <html><body>，只返回内容
 */
export default function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
    </div>
  );
}
