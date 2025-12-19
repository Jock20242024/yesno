# 清理身份缓存 - 快速指南

## 为什么需要清除 Cookie？

之前的多次失败可能在浏览器里留下了损坏的、过期的 Session Cookie。NextAuth 看到旧的 Cookie 就会拒绝写入新的。

## 快速操作步骤（Chrome/Edge）

### 方法一：使用开发者工具（推荐）

1. **打开开发者工具**
   - 按 `F12` 键

2. **进入 Application 标签**
   - 点击顶部标签栏的 `Application`（或 `应用`）

3. **清除 Cookies**
   - 在左侧面板展开 `Cookies`
   - 点击 `http://localhost:3000`
   - **右键点击** `http://localhost:3000` -> 选择 `Clear`（或 `清除`）
   - 或者直接点击页面上的 `Clear All` 按钮

4. **刷新页面**
   - 按 `Ctrl+R`（Windows）或 `Cmd+R`（Mac）

### 方法二：使用隐私模式（最简单）

1. **打开隐私/无痕模式**
   - Chrome: `Ctrl+Shift+N`（Windows）或 `Cmd+Shift+N`（Mac）
   - Edge: `Ctrl+Shift+P`（Windows）或 `Cmd+Shift+P`（Mac）

2. **访问登录页面**
   - 在隐私模式下访问 `http://localhost:3000/admin/login`

这样就不会有任何旧的 Cookie 干扰。

## 验证清除是否成功

清除 Cookie 后：
- 重新访问 `http://localhost:3000/admin/login`
- 尝试使用 Google 登录
- 查看终端日志，应该能看到完整的监控日志流程

## 注意事项

- 清除 Cookie 会清除所有登录状态，需要重新登录
- 只清除 `localhost:3000` 的 Cookie 不会影响其他网站
- 如果使用隐私模式测试，关闭窗口后 Cookie 会自动清除
