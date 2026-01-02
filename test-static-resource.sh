#!/bin/bash

# 测试静态资源访问脚本
# 用于捕获 400 错误的真相

echo "=== 测试静态资源访问 ==="
echo ""

# 检查服务器是否运行
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ 服务器未运行，请先执行 'npm start'"
    exit 1
fi

echo "✅ 服务器正在运行"
echo ""

# 查找一个实际的静态文件路径
STATIC_FILE=$(find .next/static -name "*.js" -type f 2>/dev/null | head -1)

if [ -z "$STATIC_FILE" ]; then
    echo "⚠️ 未找到静态文件，请先执行 'npm run build'"
    exit 1
fi

# 转换为 URL 路径（.next/static/... -> /_next/static/...）
URL_PATH="/_next/${STATIC_FILE#.next/static/}"

echo "📄 测试文件: $URL_PATH"
echo ""

# 使用 curl 测试，显示详细的响应头
echo "=== 测试 1: HEAD 请求（只获取响应头） ==="
curl -I -v "http://localhost:3000$URL_PATH" 2>&1 | grep -E "< HTTP|Server:|Content-Type:|Content-Length:|< |400|200"

echo ""
echo "=== 测试 2: GET 请求（获取完整响应） ==="
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nSIZE:%{size_download}\n" "http://localhost:3000$URL_PATH" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
SIZE=$(echo "$RESPONSE" | grep "SIZE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d' | sed '/SIZE/d')

echo "HTTP 状态码: $HTTP_CODE"
echo "响应大小: $SIZE bytes"
echo ""

if [ "$HTTP_CODE" = "400" ]; then
    echo "❌ 返回 400 错误"
    echo ""
    echo "响应内容（前 500 字符）:"
    echo "$BODY" | head -c 500
    echo ""
    echo ""
    echo "🔍 分析："
    if echo "$BODY" | grep -q "<!DOCTYPE html>"; then
        echo "  → 返回了 HTML 页面（可能是重定向或错误页面）"
    elif echo "$BODY" | grep -q "Invalid"; then
        echo "  → 返回了错误消息"
    else
        echo "  → 响应体内容异常"
    fi
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 返回 200 成功"
    echo "响应内容类型: JavaScript"
else
    echo "⚠️ 返回其他状态码: $HTTP_CODE"
fi

