/**
 * 🔥 Prisma 事务工具函数
 * 
 * 解决 Serverless 环境中的 Prisma 事务连接问题
 * 提供统一的事务执行逻辑，包括连接检查和重试机制
 */

import { prisma } from '@/lib/prisma';

/**
 * 事务执行选项
 */
export interface TransactionOptions {
  timeout?: number; // 事务超时时间（毫秒），默认 30000
  maxRetries?: number; // 最大重试次数，默认 2
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'; // 隔离级别，默认 ReadCommitted
}

/**
 * 🔥 执行 Prisma 事务（带重试机制）
 * 
 * 在 Serverless 环境中，Prisma 连接可能会断开，导致事务 ID 失效。
 * 此函数会自动处理连接问题并重试。
 * 
 * @param callback 事务回调函数
 * @param options 事务选项
 * @returns 事务执行结果
 */
export async function executeTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    maxRetries = 2,
    isolationLevel = 'ReadCommitted',
  } = options;

  // 🔥 确保连接活跃
  try {
    await prisma.$connect();
  } catch (connectError) {
    // 连接已存在或连接失败，继续执行
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [Prisma Transaction] 连接检查:', connectError);
    }
  }

  let retryCount = 0;
  let lastError: any;

  while (retryCount <= maxRetries) {
    try {
      const result = await prisma.$transaction(callback, {
        timeout,
        isolationLevel,
      });
      return result;
    } catch (transactionError: any) {
      lastError = transactionError;

      // 检查是否是事务连接问题
      const isConnectionError =
        transactionError.code === 'P2028' ||
        transactionError.message?.includes('Transaction not found') ||
        transactionError.message?.includes('Transaction ID is invalid') ||
        transactionError.message?.includes('old closed transaction');

      if (isConnectionError && retryCount < maxRetries) {
        retryCount++;
        console.warn(
          `⚠️ [Prisma Transaction] 事务连接失效，尝试重新连接 (${retryCount}/${maxRetries}):`,
          transactionError.message
        );

        // 断开并重新连接
        try {
          await prisma.$disconnect();
        } catch (disconnectError) {
          // 忽略断开错误
        }

        // 等待一小段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          await prisma.$connect();
        } catch (reconnectError) {
          console.error('❌ [Prisma Transaction] 重新连接失败:', reconnectError);
        }

        continue; // 重试
      } else {
        // 不是连接错误，或重试次数用尽，直接抛出
        throw transactionError;
      }
    }
  }

  // 如果所有重试都失败，抛出最后一个错误
  throw new Error(
    `事务执行失败：连接问题，已重试 ${maxRetries} 次。请稍后重试。原始错误: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * 🔥 执行简单的 Prisma 查询（带连接检查）
 * 
 * 对于不需要事务的查询，使用此函数确保连接活跃
 * 
 * @param callback 查询回调函数
 * @returns 查询结果
 */
export async function executeQuery<T>(
  callback: () => Promise<T>
): Promise<T> {
  try {
    await prisma.$connect();
  } catch (connectError) {
    // 连接已存在或连接失败，继续执行
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [Prisma Query] 连接检查:', connectError);
    }
  }

  return callback();
}

