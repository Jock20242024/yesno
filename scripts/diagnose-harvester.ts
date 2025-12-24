/**
 * 诊断脚本：打印 Polymarket 市场的标签结构
 * 运行方式: npx tsx scripts/diagnose-harvester.ts
 */

import { diagnoseMarketTags } from '../lib/factory/harvester';

async function main() {
  try {
    console.log('🚀 开始运行诊断模式...\n');
    await diagnoseMarketTags();
    console.log('\n✅ 诊断完成！请查看上方的日志输出。');
    process.exit(0);
  } catch (error) {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  }
}

main();
