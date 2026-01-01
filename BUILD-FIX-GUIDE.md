# 构建错误修复指南

**错误**: webpack 构建失败，PostCSS 插件加载问题

---

## 🔧 修复步骤

### 步骤 1: 清理构建缓存和依赖

```bash
# 清理构建缓存
rm -rf .next

# 清理 node_modules 和 package-lock.json（如果需要）
rm -rf node_modules package-lock.json

# 重新安装依赖
npm install
```

### 步骤 2: 验证 PostCSS 配置

确保 `postcss.config.js` 存在且配置正确：

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 步骤 3: 重新构建

```bash
# 加载环境变量（如果需要）
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 重新构建
npm run build
```

### 步骤 4: 如果仍然失败，检查依赖

```bash
# 检查 PostCSS 相关依赖
npm list postcss autoprefixer tailwindcss

# 如果没有安装，重新安装
npm install --save-dev postcss autoprefixer tailwindcss
```

---

## 🚀 快速修复命令

```bash
# 1. 清理
rm -rf .next node_modules package-lock.json

# 2. 重新安装
npm install

# 3. 重新构建
npm run build

# 4. 启动
npm start
```

---

## ⚠️ 常见问题

### 问题 1: PostCSS 插件未找到

**解决方案**:
```bash
npm install --save-dev postcss autoprefixer tailwindcss
```

### 问题 2: 构建缓存问题

**解决方案**:
```bash
rm -rf .next
npm run build
```

### 问题 3: node_modules 损坏

**解决方案**:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

**执行修复**: 运行上述快速修复命令

