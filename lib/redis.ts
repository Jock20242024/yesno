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
 * 🔥 强制修复：确保始终返回有效的客户端实例，禁止返回 undefined
 */
export function getRedisClient(): Redis {
  // 🔥 强制初始化：如果未初始化，立即创建
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    isConnecting = true;
    
    // 🔥 强制创建实例，不允许失败
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // 🔥 修复：BullMQ 要求必须为 null
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

        isConnecting = false;
      });

      redisClient.on('ready', () => {

        isConnecting = false;
      });

      redisClient.on('close', () => {
        console.warn('⚠️ [Redis] 连接已关闭');
        isConnecting = false;
      });

      redisClient.on('reconnecting', () => {

        isConnecting = true;
      });
    } catch (error: any) {
      // 🔥 即使创建失败，也要创建一个占位实例，避免返回 undefined
      console.error('❌ [Redis] 创建客户端失败:', error.message);
      // 创建一个基础的 Redis 实例（即使连接失败）
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true, // 延迟连接
        enableOfflineQueue: false,
      });
    }
  }

  // 🔥 强制断言：确保返回的不是 undefined
  if (!redisClient) {
    throw new Error('Redis client initialization failed');
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
    const client = getRedisClient();
    const value = await client.get(SCHEDULER_STATUS_KEY);
    
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
    const client = getRedisClient();
    await client.set(SCHEDULER_STATUS_KEY, active ? 'true' : 'false');

  } catch (error: any) {
    console.error(`❌ [Redis] 设置调度器状态失败: ${error.message}`);
    throw error;
  }
}
