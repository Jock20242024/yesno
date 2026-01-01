# API Key 使用示例

## 概述

创建 API Key 后，您可以使用该 Key 通过代码进行程序化交易。API Key 通过 HTTP Header `Authorization: Bearer {your_api_key}` 进行认证。

## Python 示例

```python
import requests

# 您的 API Key（从个人中心获取）
API_KEY = "sk_live_your_actual_api_key_here"

# API 基础 URL
BASE_URL = "http://localhost:3000"  # 或生产环境 URL

# 设置请求头
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# 示例 1: 查询用户资产
def get_user_assets():
    response = requests.get(
        f"{BASE_URL}/api/user/assets",
        headers=headers
    )
    if response.status_code == 200:
        data = response.json()
        print("用户资产:", data)
        return data
    else:
        print("错误:", response.text)
        return None

# 示例 2: 创建订单（下单）
def create_order(market_id, outcome, amount):
    payload = {
        "marketId": market_id,
        "outcomeSelection": outcome,  # "YES" 或 "NO"
        "amount": amount,
        "orderType": "MARKET",  # 或 "LIMIT"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/orders",
        headers=headers,
        json=payload
    )
    if response.status_code == 200:
        data = response.json()
        print("订单创建成功:", data)
        return data
    else:
        print("错误:", response.text)
        return None

# 使用示例
if __name__ == "__main__":
    # 查询资产
    assets = get_user_assets()
    
    # 创建订单（示例：购买 $100 的 YES）
    # order = create_order(
    #     market_id="your-market-id",
    #     outcome="YES",
    #     amount=100.0
    # )
```

## cURL 示例

```bash
# 设置 API Key
API_KEY="sk_live_your_actual_api_key_here"
BASE_URL="http://localhost:3000"

# 查询用户资产
curl -X GET "${BASE_URL}/api/user/assets" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json"

# 创建订单
curl -X POST "${BASE_URL}/api/orders" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "your-market-id",
    "outcomeSelection": "YES",
    "amount": 100.0,
    "orderType": "MARKET"
  }'
```

## JavaScript/Node.js 示例

```javascript
const fetch = require('node-fetch'); // 或使用 axios

const API_KEY = 'sk_live_your_actual_api_key_here';
const BASE_URL = 'http://localhost:3000';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// 查询用户资产
async function getUserAssets() {
  const response = await fetch(`${BASE_URL}/api/user/assets`, {
    method: 'GET',
    headers: headers,
  });
  
  const data = await response.json();
  console.log('用户资产:', data);
  return data;
}

// 创建订单
async function createOrder(marketId, outcome, amount) {
  const response = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      marketId,
      outcomeSelection: outcome, // 'YES' 或 'NO'
      amount,
      orderType: 'MARKET',
    }),
  });
  
  const data = await response.json();
  console.log('订单创建结果:', data);
  return data;
}

// 使用
getUserAssets();
// createOrder('market-id', 'YES', 100);
```

## 安全注意事项

1. **永远不要将 API Key 提交到版本控制系统（Git）**
2. **使用环境变量存储 API Key**
3. **定期轮换 API Key**
4. **只授予必要的权限**
5. **如果 Key 泄露，立即删除并重新创建**

## 支持的 API 端点

所有需要身份验证的 API 端点都支持 API Key 认证，包括：

- `GET /api/user/assets` - 查询用户资产
- `POST /api/orders` - 创建订单
- `GET /api/orders/user` - 查询用户订单
- `GET /api/transactions` - 查询交易记录
- 等等...

只要在请求头中包含 `Authorization: Bearer {your_api_key}` 即可。

