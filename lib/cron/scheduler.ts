/**
 * 🔥 内部定时任务调度器（单例模式）
 * 在 API 路由中自动初始化，定期调用工厂市场生成和结算逻辑
 * 无需外部 cron 服务（如 Vercel Cron、GitHub Actions）
 */

import cron from 'node-cron';
import { runRelayEngine } from '@/lib/factory/relay';
import { runSettlementScanner } from '@/lib/factory/settlement';
import { syncOdds } from '@/lib/scrapers/oddsRobot';
import { startOddsWorker } from '@/lib/queue/oddsQueue';
import { getSchedulerActiveStatus } from '@/lib/redis';

// 单例标志
let isSchedulerStarted = false;

// 🔥 性能优化：Cron 防重叠锁机制
let isOddsSyncRunning = false;
let isFactoryRelayRunning = false;

/**
 * 启动所有定时任务（单例模式，只启动一次）
 */
export function startCronScheduler(): void {
  // 只在服务器端运行（非浏览器环境）
  if (typeof window !== 'undefined') {
    return;
  }

  // 如果已经启动，直接返回
  if (isSchedulerStarted) {
    return;
  }

  console.log('🚀 [Cron Scheduler] 启动内部定时任务调度器...');

  // 0. 启动赔率同步队列工作器（只需要启动一次）
  try {
    startOddsWorker();
    console.log('✅ [Cron Scheduler] 赔率同步队列工作器已启动');
  } catch (error: any) {
    console.error('❌ [Cron Scheduler] 启动赔率同步队列工作器失败:', error.message);
  }

  // 1. 赔率同步（每30秒执行一次）
  // 用于实时同步工厂市场和 Polymarket 市场的赔率数据
  cron.schedule('*/30 * * * * *', async () => {
    // 🔥 全局开关检查：从 Redis 读取状态
    try {
      const isActive = await getSchedulerActiveStatus();
      if (!isActive) {
        // 只在第一次跳过时输出日志，避免刷屏
        return;
      }
    } catch (error: any) {
      // Redis 不可用时，默认继续运行（容错处理）
      console.warn(`⚠️ [Cron Scheduler] 读取调度器状态失败: ${error.message}，继续运行`);
    }
    
    // 🔥 性能优化：防重叠锁机制
    if (isOddsSyncRunning) {
      return; // 上一次任务还在运行，直接跳过
    }
    
    try {
      isOddsSyncRunning = true;
      await syncOdds();
    } catch (error: any) {
      console.error('❌ [Cron Scheduler] 赔率同步失败:', error.message);
    } finally {
      isOddsSyncRunning = false; // 确保锁被释放
    }
  });

  // 2. 工厂市场自动接力与结算（每30秒执行一次）
  // 用于确保工厂市场永不断流，并及时结算已到期的市场
  cron.schedule('*/30 * * * * *', async () => {
    // 🔥 全局开关检查：从 Redis 读取状态
    try {
      const isActive = await getSchedulerActiveStatus();
      if (!isActive) {
        // 只在第一次跳过时输出日志，避免刷屏
        return;
      }
    } catch (error: any) {
      // Redis 不可用时，默认继续运行（容错处理）
      console.warn(`⚠️ [Cron Scheduler] 读取调度器状态失败: ${error.message}，继续运行`);
    }
    
    // 🔥 性能优化：防重叠锁机制
    if (isFactoryRelayRunning) {
      return; // 上一次任务还在运行，直接跳过
    }
    
    try {
      isFactoryRelayRunning = true;
      
      // 1. 先执行自动结算
      await runSettlementScanner();
      
      // 2. 再执行自动接力（内部会更新心跳）
      await runRelayEngine();
    } catch (error: any) {
      // 🔥 修复：即使出错也要确保心跳被更新（表示至少尝试运行了）
      console.error('❌ [Cron Scheduler] 执行失败:', error.message);
      // 注意：心跳更新在 runRelayEngine 的 finally 块中，所以即使出错也会更新
    } finally {
      isFactoryRelayRunning = false; // 确保锁被释放
    }
  });

  // 2. T+1 预产制（每天 UTC 0点执行）
  // 一次性预生成未来24-48小时内的所有市场
  // 注意：这个功能由 factory-pregen API 提供，如果需要可以在这里调用
  // 暂时注释掉，因为 runRelayEngine 已经包含了预生成逻辑
  
  isSchedulerStarted = true;
  
  // 读取初始状态
  getSchedulerActiveStatus().then(isActive => {
    console.log('✅ [Cron Scheduler] 定时任务已启动:');
    console.log('   - 赔率同步: 每30秒', isActive ? '(运行中)' : '(已暂停)');
    console.log('   - 工厂市场自动接力与结算: 每30秒', isActive ? '(运行中)' : '(已暂停)');
  }).catch(() => {
    console.log('✅ [Cron Scheduler] 定时任务已启动（默认运行中）');
    console.log('   - 赔率同步: 每30秒');
    console.log('   - 工厂市场自动接力与结算: 每30秒');
  });
}

/**
 * 检查调度器是否已启动
 */
export function isSchedulerRunning(): boolean {
  return isSchedulerStarted;
}
