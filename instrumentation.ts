/**
 * Next.js Instrumentation Hook
 * 在应用启动时自动执行初始化代码
 * 
 * 用于启动内部定时任务调度器，确保心跳监测正常工作
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 只在服务器端运行
    const { startCronScheduler } = await import('@/lib/cron/scheduler');
    startCronScheduler();
    console.log('✅ [Instrumentation] 定时任务调度器已启动');
  }
}
