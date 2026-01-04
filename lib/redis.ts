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
export function getRedisClient(): Redis | null {
  // 🔥 强制初始化：如果未初始化，立即创建
  if (!redisClient) {
    // 🔥 关键修复：必须使用环境变量 REDIS_URL，严禁连接 127.0.0.1
    const redisUrl = process.env.REDIS_URL;
    
    // 🔥 如果获取不到环境变量，直接返回 null 或抛出清晰的错误
    if (!redisUrl) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ [Redis] 生产环境未配置 REDIS_URL，Redis 功能不可用');
        return null; // 生产环境返回 null，不创建实例
      } else {
        // 开发环境可以尝试本地连接，但记录警告
        console.warn('⚠️ [Redis] REDIS_URL 未配置，尝试连接本地 Redis (仅开发环境)');
        const localUrl = 'redis://localhost:6379';
        redisClient = new Redis(localUrl, {
          maxRetriesPerRequest: null,
          connectTimeout: 5000,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        return redisClient;
      }
    }
    
    // 🔥 检测是否为 TLS 连接（rediss:// 开头）
    const isTLS = redisUrl.startsWith('rediss://');
    const isUpstash = redisUrl.includes('upstash.io');
    
    // 🔥 如果是 redis:// 但指向 Upstash，转换为 rediss://
    let finalRedisUrl = redisUrl;
    if (isUpstash && redisUrl.startsWith('redis://')) {
      finalRedisUrl = redisUrl.replace('redis://', 'rediss://');
      console.log('✅ [Redis] 检测到 Upstash Redis，已启用 TLS 连接');
    }
    
    isConnecting = true;
    
    // 🔥 强制创建实例，不允许失败
    try {
      const redisOptions: any = {
        maxRetriesPerRequest: null, // 🔥 修复：BullMQ 要求必须为 null
        connectTimeout: 10000, // 10 秒连接超时
        lazyConnect: false, // 立即连接
        retryStrategy(times: number) {
          const delay = Math.min(times * 50, 2000);
          console.warn(`⚠️ [Redis] 连接重试 ${times} 次，延迟 ${delay}ms`);
          return delay;
        },
        reconnectOnError(err: Error) {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true; // 重新连接
          }
          return false;
        },
        enableOfflineQueue: false, // 禁用离线队列，避免错误堆积
      };
      
      // 🔥 TLS 配置：如果是 rediss:// 开头（TLS 连接），必须配置 TLS
      if (isTLS || isUpstash) {
        redisOptions.tls = {
          // 🔥 关键修复：Upstash 使用自签名证书，必须设置 rejectUnauthorized: false
          rejectUnauthorized: false,
        };
        console.log('✅ [Redis] 已配置 TLS 连接 (rejectUnauthorized: false)');
      }
      
      redisClient = new Redis(finalRedisUrl, redisOptions);

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
      // 🔥 创建失败时，生产环境返回 null，开发环境创建占位实例
      console.error('❌ [Redis] 创建客户端失败:', error.message);
      
      if (process.env.NODE_ENV === 'production') {
        return null; // 生产环境返回 null
      }
      
      // 开发环境创建占位实例
      const fallbackOptions: any = {
        maxRetriesPerRequest: null,
        lazyConnect: true, // 延迟连接
        enableOfflineQueue: false,
      };
      
      // 如果是 TLS 连接，也要配置 TLS
      if (isTLS || isUpstash) {
        fallbackOptions.tls = {
          rejectUnauthorized: false,
        };
      }
      
      redisClient = new Redis(finalRedisUrl, fallbackOptions);
    }
  }

  // 🔥 返回客户端实例（可能为 null）
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
    if (!client) {
      console.warn('⚠️ [Redis] 客户端不可用，默认返回启用状态');
      return true;
    }
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
    if (!client) {
      throw new Error('Redis 客户端不可用，无法设置调度器状态');
    }
    await client.set(SCHEDULER_STATUS_KEY, active ? 'true' : 'false');

  } catch (error: any) {
    console.error(`❌ [Redis] 设置调度器状态失败: ${error.message}`);
    throw error;
  }
}
