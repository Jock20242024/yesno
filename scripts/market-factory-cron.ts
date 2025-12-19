/**
 * 市场工厂定时任务脚本
 * 每分钟执行一次，检查模板并创建市场
 * 
 * 运行方式：
 * 1. 开发环境：node -r ts-node/register scripts/market-factory-cron.ts
 * 2. 生产环境：使用 PM2 或其他进程管理器
 * 3. 或使用系统的 cron: */1 * * * * cd /path/to/project && npm run cron:market-factory
 */

const cron = require('node-cron');
const { checkAndCreateMarkets } = require('../lib/marketFactory');

console.log('🚀 [MarketFactory Cron] 启动定时任务...');
console.log('📅 [MarketFactory Cron] 计划: 每分钟执行一次');

// 每分钟的第 0 秒执行（即每分钟执行一次）
cron.schedule('* * * * *', async () => {
  try {
    console.log(`\n⏰ [MarketFactory Cron] ${new Date().toISOString()} - 开始检查模板...`);
    await checkAndCreateMarkets();
    console.log(`✅ [MarketFactory Cron] ${new Date().toISOString()} - 检查完成\n`);
  } catch (error) {
    console.error(`❌ [MarketFactory Cron] ${new Date().toISOString()} - 执行失败:`, error);
  }
});

console.log('✅ [MarketFactory Cron] 定时任务已启动，等待执行...');

// 保持进程运行
process.on('SIGINT', () => {
  console.log('\n🛑 [MarketFactory Cron] 收到 SIGINT，正在停止...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 [MarketFactory Cron] 收到 SIGTERM，正在停止...');
  process.exit(0);
});
