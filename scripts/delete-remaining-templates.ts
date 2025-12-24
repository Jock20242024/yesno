/**
 * 🗑️ 删除剩余的4个抓取模板
 * 根据图片中的模板名称精确删除
 */

import { prisma } from '../lib/prisma';

async function deleteRemainingTemplates() {
  try {
    console.log('🔍 [Delete Script] 开始查找剩余的抓取模板...');

    // 根据图片中的精确名称查找
    const templateNames = [
      'DOGE above $[StrikePrice] on [EndTime]?',
      'Will Trump release more Epstein files in 2025?',
      'Bank of Canada decision in [EndTime]?',
      'What price will DOGE hit before 2027?',
    ];

    const templatesToDelete = await prisma.marketTemplate.findMany({
      where: {
        name: {
          in: templateNames,
        },
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        period: true,
      },
    });

    console.log(`📊 [Delete Script] 找到 ${templatesToDelete.length} 个匹配的模板\n`);

    if (templatesToDelete.length === 0) {
      console.log('✅ [Delete Script] 没有找到需要删除的模板');
      return;
    }

    // 打印要删除的模板列表
    console.log('📋 [Delete Script] 将要删除的模板列表:');
    templatesToDelete.forEach((t, idx) => {
      console.log(`  ${idx + 1}. ${t.name} (${t.symbol}, ${t.period}分钟)`);
    });

    // 删除这些模板
    const deleteResult = await prisma.marketTemplate.deleteMany({
      where: {
        name: {
          in: templateNames,
        },
      },
    });

    console.log(`\n✅ [Delete Script] 成功删除 ${deleteResult.count} 个抓取的模板`);
    console.log('✅ [Delete Script] 任务完成！');
  } catch (error: any) {
    console.error('❌ [Delete Script] 删除失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行删除
deleteRemainingTemplates()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
