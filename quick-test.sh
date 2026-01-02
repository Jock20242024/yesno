#!/bin/bash

# 快速测试静态资源访问

echo "=== 快速测试静态资源 ==="
echo ""

# 测试文件路径
TEST_URL="http://localhost:3000/_next/static/chunks/2117-7a930db66043ac4e.js"

echo "测试 URL: $TEST_URL"
echo ""

# HEAD 请求
echo "=== HEAD 请求 ==="
curl -I "$TEST_URL" 2>&1 | head -10

echo ""
echo "=== GET 请求（前 100 字符） ==="
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$TEST_URL" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP 状态码: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 成功！响应大小: $(echo "$BODY" | wc -c) bytes"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "❌ 400 错误"
    echo "响应内容（前 200 字符）:"
    echo "$BODY" | head -c 200
    echo ""
else
    echo "⚠️ 状态码: $HTTP_CODE"
fi

