# TailwindCSS 模块缺失修复

**错误**: `Cannot find module 'tailwindcss'`

---

## 🔍 问题原因

错误信息显示找不到 `tailwindcss` 模块。可能的原因：

1. **使用 `npm install --production` 只安装了生产依赖**
   - `tailwindcss` 在 `devDependencies` 中
   - 生产安装会跳过 devDependencies

2. **node_modules 损坏或不完整**

---

## 🔧 修复方案

### 方案 1: 完整安装所有依赖（推荐）

```bash
# 删除 node_modules（如果需要）
rm -rf node_modules package-lock.json

# 完整安装所有依赖（包括 devDependencies）
npm install

# 清理构建缓存
rm -rf .next

# 重新构建
npm run build
```

### 方案 2: 仅安装 devDependencies

```bash
# 安装所有 devDependencies
npm install --save-dev postcss autoprefixer tailwindcss

# 验证安装
npm list tailwindcss

# 清理构建缓存
rm -rf .next

# 重新构建
npm run build
```

---

## ⚠️ 重要提示

### 生产环境部署注意事项

**问题**: 生产环境通常使用 `npm install --production`，这会跳过 devDependencies，导致 tailwindcss 缺失。

**解决方案**:

1. **开发环境**: 使用 `npm install`（安装所有依赖）
2. **构建阶段**: 需要 devDependencies（TailwindCSS 用于构建 CSS）
3. **生产运行**: 只需要运行已构建的文件，不需要 devDependencies

**正确的部署流程**:

```bash
# 1. 安装所有依赖（包括 devDependencies）
npm install

# 2. 构建应用（构建过程中需要 TailwindCSS）
npm run build

# 3. 生产运行（只需要运行已构建的文件）
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

---

**修复命令**: `npm install`（安装所有依赖，包括 devDependencies）

