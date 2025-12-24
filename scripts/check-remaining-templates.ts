/**
 * 检查剩余的模板，识别需要删除的抓取模板
 */

import { prisma } from '../lib/prisma';

async function checkRemainingTemplates() {
  try {
    console.log('🔍 [Check Script] 检查所有模板...');

    const allTemplates = await prisma.marketTemplate.findMany({
      select: {
        id: true,
        name: true,
        symbol: true,
        period: true,
        seriesId: true,
        titleTemplate: true,
        displayTemplate: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`\n📊 [Check Script] 总共有 ${allTemplates.length} 个模板\n`);

    allTemplates.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.name}`);
      console.log(`   标的: ${t.symbol}, 周期: ${t.period}分钟`);
      console.log(`   seriesId: ${t.seriesId || 'null'}`);
      console.log(`   titleTemplate: ${t.titleTemplate?.substring(0, 60) || 'null'}...`);
      console.log(`   displayTemplate: ${t.displayTemplate || 'null'}`);
      console.log('');
    });

    // 识别可能是抓取的模板（没有 seriesId 但名称看起来像 Polymarket 风格）
    const suspiciousTemplates = allTemplates.filter(t => {
      const name = t.name.toLowerCase();
      // 检查是否是 Polymarket 风格的问题（包含 "will", "what", "above", "hit" 等）
      const isPolymarketStyle = 
        name.includes('will ') ||
        name.includes('what ') ||
        name.includes(' above ') ||
        name.includes(' hit ') ||
        name.includes('epstein') ||
        name.includes('bank of canada') ||
        (name.includes('trump') && name.includes('2025'));
      
      return isPolymarketStyle && !t.seriesId;
    });

    if (suspiciousTemplates.length > 0) {
      console.log(`\n⚠️ [Check Script] 发现 ${suspiciousTemplates.length} 个可疑的抓取模板（没有 seriesId 但名称像 Polymarket 风格）:\n`);
      suspiciousTemplates.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.name} (${t.symbol}, ${t.period}分钟)`);
      });
    }
  } catch (error: any) {
    console.error('❌ [Check Script] 检查失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkRemainingTemplates()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
