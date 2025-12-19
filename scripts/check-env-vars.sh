#!/bin/bash

# 检查环境变量脚本
# 用于验证 NextAuth 必需的环境变量是否配置正确

echo "🔍 检查 NextAuth 环境变量配置..."
echo ""

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
  echo "❌ .env 文件不存在！"
  echo "💡 请创建 .env 文件并添加以下内容："
  echo ""
  echo "NEXTAUTH_URL=http://localhost:3000"
  echo "NEXTAUTH_SECRET=your-random-secret-key-here"
  exit 1
fi

echo "✅ .env 文件存在"
echo ""

# 检查 NEXTAUTH_URL
if grep -q "^NEXTAUTH_URL=" .env; then
  NEXTAUTH_URL=$(grep "^NEXTAUTH_URL=" .env | cut -d '=' -f2-)
  if [ -n "$NEXTAUTH_URL" ]; then
    echo "✅ NEXTAUTH_URL 已配置: $NEXTAUTH_URL"
  else
    echo "❌ NEXTAUTH_URL 存在但值为空"
    echo "💡 请确保 .env 文件包含: NEXTAUTH_URL=http://localhost:3000"
  fi
else
  echo "❌ NEXTAUTH_URL 未配置"
  echo "💡 请在 .env 文件中添加: NEXTAUTH_URL=http://localhost:3000"
fi

# 检查 NEXTAUTH_SECRET
if grep -q "^NEXTAUTH_SECRET=" .env; then
  NEXTAUTH_SECRET=$(grep "^NEXTAUTH_SECRET=" .env | cut -d '=' -f2-)
  if [ -n "$NEXTAUTH_SECRET" ] && [ ${#NEXTAUTH_SECRET} -ge 32 ]; then
    echo "✅ NEXTAUTH_SECRET 已配置 (长度: ${#NEXTAUTH_SECRET})"
  elif [ -n "$NEXTAUTH_SECRET" ]; then
    echo "⚠️  NEXTAUTH_SECRET 已配置但长度较短 (${#NEXTAUTH_URL} 字符)"
    echo "💡 建议使用至少 32 位的随机字符串"
  else
    echo "❌ NEXTAUTH_SECRET 存在但值为空"
    echo "💡 请生成一个随机字符串并添加到 .env 文件"
  fi
else
  echo "❌ NEXTAUTH_SECRET 未配置"
  echo "💡 请生成一个随机字符串并添加到 .env 文件，例如："
  echo "   NEXTAUTH_SECRET=$(openssl rand -base64 32)"
fi

echo ""
echo "📝 如果发现缺少配置，请编辑 .env 文件并添加缺失的环境变量"
