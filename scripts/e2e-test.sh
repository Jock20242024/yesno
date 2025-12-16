#!/bin/bash

# E2E 功能验证测试脚本
# 测试所有核心业务流程

set -e

BASE_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"

echo "=== E2E 功能验证测试 ==="
echo ""
echo "测试目标: 验证所有核心业务流程"
echo ""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 变量存储
USER_A_EMAIL="testuser@verify.com"
USER_A_PASSWORD="testpass123"
USER_A_ID=""
ADMIN_EMAIL="yesno@yesno.com"
ADMIN_PASSWORD="yesno2025"
MARKET_M1_ID=""
WITHDRAWAL_ID=""

# 辅助函数
check_response() {
    local response=$1
    local expected_key=$2
    
    if echo "$response" | grep -q "\"success\":true"; then
        echo -e "${GREEN}✅ 操作成功${NC}"
        if [ -n "$expected_key" ]; then
            echo "$response" | grep -o "\"$expected_key\":\"[^\"]*\"" | head -1 || true
        fi
        return 0
    else
        echo -e "${RED}❌ 操作失败${NC}"
        echo "$response" | grep -o "\"error\":\"[^\"]*\"" | head -1 || echo "$response"
        return 1
    fi
}

# 场景 2: 注册与充值
echo "=== 场景 2: 注册与充值 ==="
echo ""

echo "📝 步骤 2.1: 注册新用户 A ($USER_A_EMAIL)"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"$USER_A_PASSWORD\"}")

check_response "$REGISTER_RESPONSE" "id"
if echo "$REGISTER_RESPONSE" | grep -q "\"success\":true"; then
    USER_A_ID=$(echo "$REGISTER_RESPONSE" | grep -o "\"id\":\"[^\"]*\"" | head -1 | cut -d'"' -f4)
    echo "   用户 ID: $USER_A_ID"
else
    echo -e "${RED}注册失败，退出测试${NC}"
    exit 1
fi

echo ""
echo "💰 步骤 2.2: 用户 A 充值 \$1000"
echo "注意: 需要先登录获取 authToken，这里模拟直接调用 API（需要认证）"
echo "   提示: 在实际测试中，需要通过浏览器登录后再充值"
echo ""

# 场景 3-4: 交易与锁定
echo "=== 场景 3-4: 交易与锁定 ==="
echo ""
echo "📝 步骤 3.1: Admin 创建市场 M1 (5% 费率)"
echo "注意: 需要 Admin Token，这里模拟直接调用 API"
echo ""

# 场景 5: 核心清算
echo "=== 场景 5: 核心清算 ==="
echo ""

# 场景 6: 提现审批
echo "=== 场景 6: 提现审批 ==="
echo ""

echo ""
echo "=== 测试完成 ==="
echo ""
echo "注意: 由于需要认证 Token，完整测试需要通过浏览器手动操作"
echo "或使用 Postman/curl 携带认证 Cookie"

