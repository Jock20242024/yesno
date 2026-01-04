/**
 * Redis 连接配置
 * 专门适配 Upstash Redis 的稳定版本
 */

import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// 全局 Redis 客户端实例
let redis: Redis | null = null;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      // 关键配置：适配 Upstash TLS
      tls: {
        rejectUnauthorized: false
      },
      // 允许短时间排队，避免 "Stream isn't writeable" 错误
      enableOfflineQueue: true, 
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      // 生产环境只记录严重错误，避免淹没日志
      if (err.message.includes('ECONNREFUSED')) return;
      console.error('Redis Runtime Error:', err);
    });
  } catch (error) {
    console.error('Redis Initialization Failed:', error);
  }
}

// 🔥 保持向后兼容：导出所有现有函数

/**
 * 获取 Redis 客户端实例（单例模式）
 * 兼容现有代码
 */
export function getRedisClient(): Redis | null {
  return redis;
}

/**
 * 检查 Redis 连接状态
 */
export function isRedisConnected(): boolean {
  return redis !== null && redis.status === 'ready';
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedisClient(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * 🔥 调度器状态管理（使用 Redis）
 */
const SCHEDULER_STATUS_KEY = 'SYSTEM:SCHEDULER_ACTIVE';

/**
 * 获取调度器激活状态（从 Redis 读取）
 * 默认返回 true（启用状态）
 */
export async function getSchedulerActiveStatus(): Promise<boolean> {
  try {
    if (!redis) {
      console.warn('⚠️ [Redis] 客户端不可用，默认返回启用状态');
      return true;
    }
    const value = await redis.get(SCHEDULER_STATUS_KEY);
    
    // 如果没有设置值，默认返回 true（启用状态）
    if (value === null) {
      return true;
    }
    
    // 返回布尔值
    return value === 'true';
  } catch (error: any) {
    // Redis 不可用时，默认返回 true，避免阻塞系统
    console.warn(`⚠️ [Redis] 读取调度器状态失败: ${error.message}，默认返回启用状态`);
    return true;
  }
}

/**
 * 设置调度器激活状态（写入 Redis）
 */
export async function setSchedulerActiveStatus(active: boolean): Promise<void> {
  try {
    if (!redis) {
      throw new Error('Redis 客户端不可用，无法设置调度器状态');
    }
    await redis.set(SCHEDULER_STATUS_KEY, active ? 'true' : 'false');
  } catch (error: any) {
    console.error(`❌ [Redis] 设置调度器状态失败: ${error.message}`);
    throw error;
  }
}

// 默认导出（兼容新代码）
export default redis;
