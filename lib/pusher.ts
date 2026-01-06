/**
 * 🔥 Pusher 实时推送配置
 * 
 * 服务端：使用 pusher-server 推送事件
 * 客户端：使用 pusher-js 订阅频道
 */

// 🔥 服务端 Pusher 配置
let pusherServer: any = null;

export function getPusherServer() {
  if (pusherServer) {
    return pusherServer;
  }

  // 只在服务端环境初始化
  if (typeof window === 'undefined') {
    const Pusher = require('pusher');
    
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID || '2098773',
      key: process.env.PUSHER_KEY || 'e733fc62c101670f5059',
      secret: process.env.PUSHER_SECRET || 'ad4e9ea1827291fefac2',
      cluster: process.env.PUSHER_CLUSTER || 'ap3',
      useTLS: true,
    });
  }

  return pusherServer;
}

/**
 * 推送订单簿更新事件
 * 
 * @param marketId 市场ID
 * @param orderbookData 订单簿数据
 */
export async function triggerOrderbookUpdate(
  marketId: string,
  orderbookData: {
    asks: Array<{ price: number; quantity: number; total: number; orderCount?: number }>;
    bids: Array<{ price: number; quantity: number; total: number; orderCount?: number }>;
    spread: number;
    currentPrice: number;
    ammLiquidity?: {
      totalYes: number;
      totalNo: number;
      k: number;
    };
  }
) {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      console.warn('⚠️ [Pusher] 服务端 Pusher 未初始化，跳过推送');
      return;
    }

    await pusher.trigger(
      `market-${marketId}`, // 频道名称
      'orderbook-update',   // 事件名称
      {
        timestamp: new Date().toISOString(),
        ...orderbookData,
      }
    );

    console.log(`✅ [Pusher] 订单簿更新已推送: market-${marketId}`);
  } catch (error) {
    console.error('❌ [Pusher] 推送订单簿更新失败:', error);
  }
}

/**
 * 客户端 Pusher 配置（在客户端组件中使用）
 * 
 * 使用示例：
 * ```typescript
 * import { getPusherClient } from '@/lib/pusher';
 * 
 * const pusher = getPusherClient();
 * const channel = pusher.subscribe(`market-${marketId}`);
 * channel.bind('orderbook-update', (data: any) => {
 *   // 更新订单簿UI
 * });
 * ```
 */
export function getPusherClient() {
  if (typeof window === 'undefined') {
    return null;
  }

  // 动态导入 pusher-js（仅在客户端）
  const Pusher = require('pusher-js');
  
  return new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || 'e733fc62c101670f5059', {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap3',
    forceTLS: true,
  });
}

