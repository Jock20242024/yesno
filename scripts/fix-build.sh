#!/bin/bash

# 构建修复脚本
# 用途: 修复构建错误并重新构建

set -e

echo "=========================================="
echo "构建修复脚本"
echo "=========================================="
echo ""

# 步骤 1: 清理构建缓存
echo "步骤 1: 清理构建缓存..."
rm -rf .next
echo "✅ .next 目录已清理"
echo ""

# 步骤 2: 检查依赖
echo "步骤 2: 检查依赖..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/next" ]; then
    echo "⚠️  依赖未完整安装，重新安装..."
    npm install
else
    echo "✅ 依赖已安装"
fi
echo ""

# 步骤 3: 验证 PostCSS 配置
echo "步骤 3: 验证 PostCSS 配置..."
if [ ! -f "postcss.config.js" ]; then
    echo "⚠️  postcss.config.js 不存在，创建..."
    cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF
    echo "✅ postcss.config.js 已创建"
else
    echo "✅ postcss.config.js 存在"
fi
echo ""

# 步骤 4: 验证 Tailwind 配置
echo "步骤 4: 验证 Tailwind 配置..."
if [ ! -f "tailwind.config.js" ]; then
    echo "⚠️  tailwind.config.js 不存在"
else
    echo "✅ tailwind.config.js 存在"
fi
echo ""

# 步骤 5: 检查 PostCSS 依赖
echo "步骤 5: 检查 PostCSS 依赖..."
if ! npm list postcss autoprefixer tailwindcss >/dev/null 2>&1; then
    echo "⚠️  PostCSS 依赖未安装，安装..."
    npm install --save-dev postcss autoprefixer tailwindcss
else
    echo "✅ PostCSS 依赖已安装"
fi
echo ""

# 步骤 6: 加载环境变量
echo "步骤 6: 加载环境变量..."
if [ -f ".env.production" ]; then
    export $(grep -v '^#' .env.production | grep -v '^$' | xargs 2>/dev/null || true)
    echo "✅ 环境变量已加载"
elif [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | grep -v '^$' | xargs 2>/dev/null || true)
    echo "✅ 环境变量已加载（从 .env.local）"
elif [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep -v '^$' | xargs 2>/dev/null || true)
    echo "✅ 环境变量已加载（从 .env）"
else
    echo "⚠️  未找到环境变量文件"
fi
echo ""

# 步骤 7: 重新构建
echo "步骤 7: 重新构建..."
echo "开始构建（这可能需要几分钟）..."
if npm run build; then
    echo ""
    echo "✅ 构建成功!"
    echo ""
    echo "可以启动应用了:"
    echo "  npm start"
else
    echo ""
    echo "❌ 构建失败"
    echo ""
    echo "请检查:"
    echo "  1. 所有依赖是否已安装"
    echo "  2. PostCSS 配置是否正确"
    echo "  3. 环境变量是否正确配置"
    exit 1
fi

