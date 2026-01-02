#!/bin/bash

# 启动服务器脚本（使用新的 Header 大小限制）

echo "=== 启动生产服务器 ==="
echo ""
echo "使用配置："
echo "  - NODE_OPTIONS='--max-http-header-size=65536'"
echo "  - 端口: 3000"
echo ""

# 确保使用新的启动脚本
NODE_OPTIONS='--max-http-header-size=65536' next start -p 3000

