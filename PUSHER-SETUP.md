# Pusher 实时推送配置指南

## 环境变量配置

### Vercel 环境变量

需要在 Vercel 项目设置中添加以下环境变量：

#### 服务端环境变量（Server-side）
- `PUSHER_APP_ID`: `2098773`
- `PUSHER_KEY`: `e733fc62c101670f5059`
- `PUSHER_SECRET`: `ad4e9ea1827291fefac2`
- `PUSHER_CLUSTER`: `ap3`

#### 客户端环境变量（Client-side，必须以 `NEXT_PUBLIC_` 开头）
- `NEXT_PUBLIC_PUSHER_KEY`: `e733fc62c101670f5059`
- `NEXT_PUBLIC_PUSHER_CLUSTER`: `ap3`

## 本地开发环境配置

在 `.env.local` 文件中添加：

```bash
# Pusher 服务端配置
PUSHER_APP_ID=2098773
PUSHER_KEY=e733fc62c101670f5059
PUSHER_SECRET=ad4e9ea1827291fefac2
PUSHER_CLUSTER=ap3

# Pusher 客户端配置（必须以 NEXT_PUBLIC_ 开头）
NEXT_PUBLIC_PUSHER_KEY=e733fc62c101670f5059
NEXT_PUBLIC_PUSHER_CLUSTER=ap3
```

## 功能说明

### 1. 服务端推送（lib/pusher.ts）

- `getPusherServer()`: 获取服务端 Pusher 实例
- `triggerOrderbookUpdate()`: 推送订单簿更新事件

### 2. 客户端订阅（components/market-detail/OrderBook.tsx）

- 使用 `pusher-js` 订阅 `market-{marketId}` 频道
- 监听 `orderbook-update` 事件
- 实时更新订单簿UI（前10档）

### 3. 推送时机

- MARKET订单成交后，立即推送订单簿更新
- 包含真实订单和AMM虚拟订单
- 推送前10档深度、价差、当前价格、AMM流动性数据

## 频道和事件

- **频道名称**: `market-{marketId}`（例如：`market-abc123`）
- **事件名称**: `orderbook-update`
- **推送内容**:
  ```typescript
  {
    timestamp: string;        // ISO 8601 时间戳
    asks: OrderBookEntry[];  // 卖单列表（前10档）
    bids: OrderBookEntry[];  // 买单列表（前10档）
    spread: number;          // 价差
    currentPrice: number;    // 当前价格
    ammLiquidity: {          // AMM流动性数据
      totalYes: number;
      totalNo: number;
      k: number;
    };
  }
  ```

## 注意事项

1. **CSP配置**: 已在 `next.config.mjs` 中添加 Pusher 域名到 `connect-src`
2. **异步推送**: Pusher推送是异步执行的，不会阻塞订单响应
3. **错误处理**: Pusher推送失败不会影响订单创建
4. **客户端清理**: 组件卸载时自动取消订阅和断开连接

