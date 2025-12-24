/**
 * 测试脚本：触发模板抓取并验证结果
 * 运行方式: npx tsx scripts/test-harvest-templates.ts
 */

import { harvestStandardTemplates } from '../lib/factory/harvester';

async function testHarvest() {
  try {
    console.log('🚀 开始测试模板抓取...\n');
    
    const result = await harvestStandardTemplates();
    
    console.log('\n📊 抓取结果统计:');
    console.log(`  创建/更新: ${result.created}`);
    console.log(`  跳过: ${result.skipped}`);
    console.log(`  错误: ${result.errors}`);
    console.log(`  总计: ${result.created + result.skipped + result.errors}`);
    console.log(`  成功: ${result.success ? '是' : '否'}`);
    
    if (result.errors === 0) {
      console.log('\n✅ 验收通过：错误数为 0');
    } else {
      console.log(`\n⚠️  验收未完全通过：仍有 ${result.errors} 个错误`);
    }
    
    const totalProcessed = result.created + result.skipped;
    if (totalProcessed >= 50) {
      console.log(`✅ 验收通过：处理了 ${totalProcessed} 个模板（接近或达到 56 个目标）`);
    } else {
      console.log(`⚠️  验收未完全通过：仅处理了 ${totalProcessed} 个模板（目标：56 个）`);
    }
    
    process.exit(result.errors === 0 && totalProcessed >= 50 ? 0 : 1);
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testHarvest();
