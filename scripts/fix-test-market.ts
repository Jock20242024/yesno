/**
 * 修正测试市场数据脚本
 * 将标题包含"测试"的市场激活并设置为热门
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTestMarket() {
  console.log('🔧 ========== 修正测试市场数据 ==========\n');

  try {
    // 查询所有标题包含"测试"的市场
    const testMarkets = await prisma.market.findMany({
      where: {
        title: {
          contains: '测试',
        },
      },
    });

    console.log(`📊 找到 ${testMarkets.length} 个标题包含"测试"的市场\n`);

    if (testMarkets.length === 0) {
      console.log('⚠️  未找到任何标题包含"测试"的市场');
      return;
    }

    // 设置未来日期（2026-01-01）
    const futureDate = new Date('2026-01-01T23:59:59.000Z');

    // 更新所有测试市场
    const result = await prisma.market.updateMany({
      where: {
        title: {
          contains: '测试',
        },
      },
      data: {
        isActive: true,
        isHot: true,
        closingDate: futureDate,
      },
    });

    console.log(`✅ 成功更新 ${result.count} 个测试市场\n`);
    console.log('📝 更新内容：');
    console.log('   - isActive: true');
    console.log('   - isHot: true');
    console.log(`   - closingDate: ${futureDate.toISOString()}\n`);

    // 验证更新结果
    const updatedMarkets = await prisma.market.findMany({
      where: {
        title: {
          contains: '测试',
        },
      },
      select: {
        id: true,
        title: true,
        isActive: true,
        isHot: true,
        closingDate: true,
        templateId: true,
      },
    });

    console.log('📋 更新后的市场状态：');
    updatedMarkets.forEach((market, index) => {
      console.log(`\n   ${index + 1}. ID: ${market.id}`);
      console.log(`      标题: ${market.title}`);
      console.log(`      isActive: ${market.isActive}`);
      console.log(`      isHot: ${market.isHot}`);
      console.log(`      closingDate: ${market.closingDate.toISOString()}`);
      console.log(`      templateId: ${market.templateId || 'null'}`);
    });

    console.log('\n✅ ========== 修正完成 ==========\n');

  } catch (error) {
    console.error('❌ 更新失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 执行修正
fixTestMarket()
  .then(() => {
    console.log('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
