/**
 * Redis 连接配置
 * 用于差分同步架构的缓存存储
 * 
 * 单例模式，增强错误处理和连接超时控制
 */

import Redis from 'ioredis';

// 全局 Redis 客户端实例
let redisClient: Redis | null = null;
let isConnecting = false;

/**
 * 获取 Redis 客户端实例（单例模式）
 * 增强错误处理，防止连接失败导致全站 500 错误
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    isConnecting = true;
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000, // 10 秒连接超时
      lazyConnect: false, // 立即连接
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.warn(`⚠️ [Redis] 连接重试 ${times} 次，延迟 ${delay}ms`);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // 重新连接
        }
        return false;
      },
      enableOfflineQueue: false, // 禁用离线队列，避免错误堆积
    });

    redisClient.on('error', (err) => {
      console.error('❌ [Redis] 连接错误:', err.message);
      // 不抛出错误，避免导致应用崩溃
      // 应用应该能够处理 Redis 不可用的情况
    });

    redisClient.on('connect', () => {
      console.log('✅ [Redis] 连接成功');
      isConnecting = false;
    });

    redisClient.on('ready', () => {
      console.log('✅ [Redis] 客户端就绪');
      isConnecting = false;
    });

    redisClient.on('close', () => {
      console.warn('⚠️ [Redis] 连接已关闭');
      isConnecting = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 [Redis] 正在重连...');
      isConnecting = true;
    });
  }

  return redisClient;
}

/**
 * 检查 Redis 连接状态
 */
export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('🔒 [Redis] 连接已关闭');
  }
}
