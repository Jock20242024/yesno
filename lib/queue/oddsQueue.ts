/**
 * 赔率更新任务队列
 * 
 * 使用 BullMQ 将 Polymarket 的 outcomePrices 更新任务队列化
 */

import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

const QUEUE_NAME = 'odds-sync';

// 队列实例（单例模式）
let oddsQueue: Queue | null = null;
let oddsWorker: Worker | null = null;

/**
 * 获取赔率更新队列实例
 */
export function getOddsQueue(): Queue {
  if (!oddsQueue) {
    // BullMQ 可以直接使用 ioredis 实例
    oddsQueue = new Queue(QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // 保留 1 小时
          count: 1000, // 最多保留 1000 个
        },
        removeOnFail: {
          age: 86400, // 失败任务保留 24 小时
        },
      },
    });

    console.log('✅ [OddsQueue] 队列实例已创建');
  }

  return oddsQueue;
}

/**
 * 任务数据接口
 */
export interface OddsUpdateJobData {
  marketId: string;
  outcomePrices: string;
  initialPrice: number;
  yesProbability: number;
  noProbability: number;
}

/**
 * 启动队列工作器（处理任务）
 */
export function startOddsWorker(): void {
  if (oddsWorker) {
    console.warn('⚠️ [OddsQueue] 工作器已在运行');
    return;
  }

  oddsWorker = new Worker<OddsUpdateJobData>(
    QUEUE_NAME,
    async (job: Job<OddsUpdateJobData>) => {
      const { marketId, outcomePrices, initialPrice, yesProbability, noProbability } = job.data;

      try {
        // 更新数据库
        await prisma.market.update({
          where: { id: marketId },
          data: {
            outcomePrices,
            initialPrice,
            yesProbability,
            noProbability,
            updatedAt: new Date(),
          },
        });

        console.log(`✅ [OddsQueue] 市场 ${marketId} 更新成功`);
        return { success: true, marketId };
      } catch (error: any) {
        console.error(`❌ [OddsQueue] 市场 ${marketId} 更新失败:`, error.message);
        throw error; // 抛出错误以便 BullMQ 重试
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 10, // 并发处理 10 个任务
      limiter: {
        max: 100, // 每秒最多处理 100 个任务
        duration: 1000,
      },
    }
  );

  oddsWorker.on('completed', (job) => {
    console.log(`✅ [OddsQueue] 任务完成: ${job.id}`);
  });

  oddsWorker.on('failed', (job, err) => {
    console.error(`❌ [OddsQueue] 任务失败: ${job?.id}`, err.message);
  });

  oddsWorker.on('error', (err) => {
    console.error('❌ [OddsQueue] 工作器错误:', err);
  });

  console.log('✅ [OddsQueue] 工作器已启动');
}

/**
 * 停止队列工作器
 */
export async function stopOddsWorker(): Promise<void> {
  if (oddsWorker) {
    await oddsWorker.close();
    oddsWorker = null;
    console.log('🔒 [OddsQueue] 工作器已停止');
  }
}

/**
 * 添加更新任务到队列
 */
export async function addOddsUpdateJob(data: OddsUpdateJobData): Promise<void> {
  const queue = getOddsQueue();
  await queue.add('update-odds', data, {
    jobId: `odds-${data.marketId}`, // 使用 marketId 作为 jobId，避免重复任务
  });
}

/**
 * 批量添加更新任务
 */
export async function addOddsUpdateJobs(jobs: OddsUpdateJobData[]): Promise<void> {
  const queue = getOddsQueue();
  await queue.addBulk(
    jobs.map((data) => ({
      name: 'update-odds',
      data,
      opts: {
        jobId: `odds-${data.marketId}`, // 使用 marketId 作为 jobId
      },
    }))
  );
}

/**
 * 获取队列积压量
 */
export async function getQueueBacklog(): Promise<number> {
  try {
    const queue = getOddsQueue();
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    return waiting + active;
  } catch (error) {
    console.error('❌ [OddsQueue] 获取队列积压量失败:', error);
    return 0;
  }
}

/**
 * 清空队列
 */
export async function clearQueue(): Promise<void> {
  const queue = getOddsQueue();
  await queue.obliterate({ force: true });
  console.log('🗑️ [OddsQueue] 队列已清空');
}

/**
 * 获取队列统计信息
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  backlog: number;
}> {
  try {
    const queue = getOddsQueue();
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      backlog: waiting + active,
    };
  } catch (error) {
    console.error('❌ [OddsQueue] 获取队列统计失败:', error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      backlog: 0,
    };
  }
}
