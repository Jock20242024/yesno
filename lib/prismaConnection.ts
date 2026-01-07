/**
 * 🔥 Prisma 连接工具函数
 * 
 * 在 Serverless 环境下，Prisma 引擎可能没有正确连接
 * 此工具函数确保每次查询前都正确连接，包含重试逻辑
 */

import { prisma } from './prisma';

const MAX_RETRIES = 3;
const RETRY_DELAY = 100; // 毫秒

/**
 * 确保 Prisma 引擎已连接（带重试逻辑）
 * @param retries 剩余重试次数
 * @returns Promise<boolean> 是否连接成功
 */
export async function ensurePrismaConnected(retries: number = MAX_RETRIES): Promise<boolean> {
  try {
    // 尝试连接
    await prisma.$connect();
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // 检查是否是连接错误
    const isConnectionError = 
      errorMessage.includes('Engine is not yet connected') ||
      errorMessage.includes('Response from the Engine was empty') ||
      errorMessage.includes('Engine was empty');

    if (isConnectionError && retries > 0) {
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return ensurePrismaConnected(retries - 1);
    }

    // 重试次数用完或不是连接错误
    console.error('❌ [Prisma Connection] 连接失败:', errorMessage);
    return false;
  }
}

/**
 * 执行 Prisma 查询（自动处理连接）
 * @param queryFn 查询函数
 * @param fallbackValue 连接失败时的降级值
 * @returns Promise<T> 查询结果或降级值
 */
export async function executePrismaQuery<T>(
  queryFn: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  // 确保连接
  const connected = await ensurePrismaConnected();
  if (!connected) {
    console.warn('⚠️ [Prisma Query] 连接失败，返回降级值');
    return fallbackValue;
  }

  try {
    return await queryFn();
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // 如果是连接错误，尝试重新连接后重试一次
    const isConnectionError = 
      errorMessage.includes('Engine is not yet connected') ||
      errorMessage.includes('Response from the Engine was empty') ||
      errorMessage.includes('Engine was empty');

    if (isConnectionError) {
      console.warn('⚠️ [Prisma Query] 查询时连接断开，尝试重新连接...');
      const reconnected = await ensurePrismaConnected();
      if (reconnected) {
        try {
          return await queryFn();
        } catch (retryError) {
          console.error('❌ [Prisma Query] 重试查询失败:', retryError);
          return fallbackValue;
        }
      }
    }

    // 其他错误或重连失败
    console.error('❌ [Prisma Query] 查询失败:', errorMessage);
    return fallbackValue;
  }
}

