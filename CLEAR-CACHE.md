# 清理 Next.js 缓存指南

## 快速清理命令

```bash
# 停止开发服务器（如果在运行）

# 删除 Next.js 构建缓存
rm -rf .next

# 删除 node_modules 缓存（可选）
rm -rf node_modules/.cache

# 重新启动开发服务器
npm run dev
```

## 详细步骤

### 1. 停止开发服务器
- 在运行 `npm run dev` 的终端窗口按 `Ctrl + C`（Mac 上按 `Cmd + C`）

### 2. 删除缓存文件夹
```bash
# 进入项目目录
cd /Users/npcventures/yesno-app

# 删除 .next 文件夹（Next.js 构建缓存）
rm -rf .next

# 可选：删除 node_modules/.cache（npm 缓存）
rm -rf node_modules/.cache
```

### 3. 硬刷新浏览器
- **Chrome/Edge**: `Ctrl + Shift + R` (Windows/Linux) 或 `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + F5` (Windows/Linux) 或 `Cmd + Shift + R` (Mac)
- **Safari**: `Cmd + Option + R` (Mac)

### 4. 重新启动开发服务器
```bash
npm run dev
```

## 验证修复是否生效

### 检查火焰图标（热门按钮）
1. 打开浏览器开发者工具（F12）
2. 找到导航栏中的"热门"按钮
3. 检查 Flame 图标元素：
   - 应该看到 `flame-icon` 类名
   - 检查 computed styles 中是否有 `animation: flame-jump 1.5s ease-in-out infinite`
   - 检查 `color` 是否为 `#f97316`
   - 检查 `filter` 中是否有 `drop-shadow`

### 检查排行榜图标
1. 找到导航栏右上角的"排行榜"链接
2. 悬停（hover）时：
   - 图标应该旋转 12 度并放大 110%
   - 颜色应该为金色 `#eab308`
   - 应该有金色发光效果

### 检查分类列表
1. 刷新页面
2. 检查导航栏中是否还有"娱乐"分类
3. 如果仍然出现，打开 Network 标签查看 `/api/categories` 的响应

## 如果问题仍然存在

1. **检查浏览器控制台**是否有 JavaScript 错误
2. **检查 Network 标签**中 `/api/categories` 的响应数据
3. **检查 Elements 标签**中图标元素的实际样式
4. **尝试使用无痕/隐私模式**打开页面，排除浏览器扩展干扰
