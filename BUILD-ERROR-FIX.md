# 构建错误修复指南

**错误类型**: webpack 构建失败，PostCSS 插件加载问题

---

## 🔍 问题分析

从错误日志可以看到：
1. **webpack 构建失败** - PostCSS 插件加载错误
2. **启动失败** - 找不到生产构建文件（因为构建失败）

---

## 🔧 修复步骤

### 方法 1: 使用修复脚本（推荐）

```bash
# 执行构建修复脚本
bash scripts/fix-build.sh
```

### 方法 2: 手动修复

```bash
# 1. 清理构建缓存
rm -rf .next

# 2. 清理并重新安装依赖（如果需要）
rm -rf node_modules package-lock.json
npm install

# 3. 确保 PostCSS 依赖已安装
npm install --save-dev postcss autoprefixer tailwindcss

# 4. 加载环境变量
export $(grep -v '^#' .env.production | grep -v '^$' | xargs)

# 5. 重新构建
npm run build

# 6. 启动应用
npm start
```

---

## ✅ 验证修复

构建成功后，应该看到：

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

然后可以启动：
```bash
npm start
```

---

## 📄 相关文档

- `BUILD-FIX-GUIDE.md` - 详细构建修复指南
- `scripts/fix-build.sh` - 自动修复脚本

---

**执行修复**: 运行 `bash scripts/fix-build.sh` 或按照方法 2 手动修复

