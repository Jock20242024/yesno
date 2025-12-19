# 清除 Cookie 缓存说明

## 为什么需要清除 Cookie？

之前的 500 错误或配置错误可能在浏览器里留下了损坏的 `next-auth.session-token`，导致新登录无法覆盖旧错误。

## 如何清除 Cookie（Chrome/Edge）

### 方法一：使用开发者工具

1. **打开开发者工具**
   - 按 `F12` 键
   - 或者右键点击页面 -> 选择"检查"

2. **进入 Application 标签**
   - 点击顶部的 `Application` 标签（或 `应用` 标签）

3. **清除 Cookies**
   - 在左侧面板找到 `Cookies`
   - 展开 `Cookies` -> 点击 `http://localhost:3000`
   - 找到所有以 `next-auth` 开头的 Cookie（例如 `next-auth.session-token`）
   - 右键点击这些 Cookie -> 选择 `Delete`（或直接按 `Delete` 键）
   - 或者点击 `Clear All` 按钮清除所有 Cookie

4. **刷新页面**
   - 按 `Ctrl+R`（Windows）或 `Cmd+R`（Mac）刷新页面

### 方法二：使用浏览器设置

1. **打开浏览器设置**
   - Chrome: 点击右上角三个点 -> 设置 -> 隐私设置和安全性 -> Cookie 和其他网站数据
   - Edge: 点击右上角三个点 -> 设置 -> Cookie 和网站权限 -> Cookie 和网站数据

2. **查看所有 Cookie**
   - 点击"查看所有 Cookie 和网站数据"
   - 搜索 `localhost`
   - 找到 `localhost:3000` 并删除相关 Cookie

### 方法三：使用隐私模式测试

1. **打开隐私/无痕模式**
   - Chrome: `Ctrl+Shift+N`（Windows）或 `Cmd+Shift+N`（Mac）
   - Edge: `Ctrl+Shift+P`（Windows）或 `Cmd+Shift+P`（Mac）

2. **访问应用**
   - 在隐私模式下访问 `http://localhost:3000/admin/login`
   - 这样可以确保没有任何旧的 Cookie 干扰

## 验证 Cookie 是否已清除

清除后，重新访问 `http://localhost:3000/admin/login` 并尝试登录。如果登录成功，说明 Cookie 已正确清除。

## 常见问题

### Q: 清除 Cookie 后需要重新登录吗？
A: 是的，清除 Cookie 会清除所有登录状态，需要重新登录。

### Q: 只清除 next-auth.session-token 可以吗？
A: 建议清除所有 localhost 的 Cookie，以确保完全清除可能存在的错误状态。

### Q: 清除 Cookie 会影响其他网站吗？
A: 不会，只清除 `localhost:3000` 的 Cookie 不会影响其他网站。
