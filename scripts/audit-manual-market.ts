/**
 * 手动市场数据库物理状态诊断脚本
 * 任务 1：底层数据库物理状态取证
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
} as any);

async function auditManualMarket() {
  console.log('🔍 ========== 手动市场数据库物理状态取证 ==========\n');

  try {
    // 🔥 修改搜索逻辑：使用标题模糊搜索，不限制 ID 前缀
    // 物理要求：严禁添加任何 status, isActive, reviewStatus 的过滤条件
    const testMarkets = await prisma.market.findMany({
      where: {
        title: {
          contains: '测试',
        },
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    console.log(`📊 找到 ${testMarkets.length} 个标题包含"测试"的市场\n`);

    if (testMarkets.length === 0) {
      console.log('⚠️  未找到任何标题包含"测试"的市场');
      console.log('💡 提示: 请确保后台创建的市场标题中包含"测试"关键词');
      return;
    }

    // 如果有多个，选择第一个
    const testMarket = testMarkets[0];
    
    if (testMarkets.length > 1) {
      console.log(`⚠️  找到多个标题包含"测试"的市场，将显示第一个（共 ${testMarkets.length} 个）\n`);
      testMarkets.forEach((market, index) => {
        console.log(`   ${index + 1}. ID: ${market.id} | 标题: ${market.title}`);
      });
      console.log('');
    }

    console.log('✅ 找到目标市场：\n');
    console.log('📋 ========== 完整字段信息（原始全貌）==========\n');

    // 🔥 关键字段打印（根据用户要求）
    console.log('🔑 核心标识字段：');
    console.log(`   id: "${testMarket.id}"`);
    console.log(`   title: "${testMarket.title}"`);
    console.log(`   titleZh: "${testMarket.titleZh || 'null'}"`);
    console.log(`   ⚠️  ID 是否以 manual- 开头: ${testMarket.id.startsWith('manual-') ? '✅ 是' : '❌ 否'}`);

    console.log('\n📊 状态字段（核心关注点 - 真实值）：');
    console.log(`   status: "${testMarket.status}" (类型: ${typeof testMarket.status})`);
    console.log(`   reviewStatus: "${testMarket.reviewStatus}" (类型: ${typeof testMarket.reviewStatus})`);
    console.log(`   isActive: ${testMarket.isActive} (类型: ${typeof testMarket.isActive})`);
    console.log(`   isHot: ${testMarket.isHot} (类型: ${typeof testMarket.isHot})`);

    // 分类信息（核心关注点 - 真实值）
    console.log('\n🏷️  分类信息（核心关注点 - 真实值）：');
    if (testMarket.categories && testMarket.categories.length > 0) {
      testMarket.categories.forEach((mc, index) => {
        console.log(`   分类 ${index + 1}:`);
        console.log(`     categoryId: "${mc.categoryId}"`);
        console.log(`     分类名称: "${mc.category?.name || 'N/A'}"`);
        console.log(`     分类 Slug: "${mc.category?.slug || 'N/A'}"`);
      });
    } else {
      console.log('   ⚠️  未关联任何分类（categories 为空数组）');
    }
    console.log(`   兼容字段 category: "${testMarket.category || 'null'}"`);
    console.log(`   兼容字段 categorySlug: "${testMarket.categorySlug || 'null'}"`);

    // templateId（核心关注点 - 真实值）
    console.log('\n🏭 模板相关字段（核心关注点 - 真实值）：');
    console.log(`   templateId: "${testMarket.templateId || 'null'}"`);
    console.log(`   isFactory: ${testMarket.isFactory || false} (类型: ${typeof (testMarket.isFactory || false)})`);
    console.log(`   period: "${testMarket.period || 'null'}"`);

    // 时间字段
    console.log('\n⏰ 时间字段：');
    const now = new Date();
    console.log(`   当前时间 (UTC): ${now.toISOString()}`);
    console.log(`   closingDate: ${testMarket.closingDate.toISOString()}`);
    console.log(`   createdAt: ${testMarket.createdAt.toISOString()}`);
    console.log(`   updatedAt: ${testMarket.updatedAt.toISOString()}`);

    const closingDate = new Date(testMarket.closingDate);
    const isClosed = closingDate < now;
    console.log(`   ⚠️  是否已过期: ${isClosed ? '是（已过期）' : '否（未过期）'}`);

    // 其他关键字段
    console.log('\n📈 其他关键字段：');
    console.log(`   totalVolume: ${testMarket.totalVolume}`);
    console.log(`   source: "${testMarket.source}"`);
    console.log(`   externalId: "${testMarket.externalId || 'null'}"`);
    console.log(`   description: "${testMarket.description.substring(0, 100)}${testMarket.description.length > 100 ? '...' : ''}"`);

    console.log('\n✅ ========== 诊断完成 ==========\n');

    // 🔥 关键信息总结（用于修复 API）
    console.log('\n📝 ========== 关键信息总结（用于修复 API）==========');
    console.log(`   ✅ id: "${testMarket.id}"`);
    console.log(`   ✅ status: "${testMarket.status}" (注意：这是真实的状态值，可能不是 "OPEN")`);
    console.log(`   ✅ reviewStatus: "${testMarket.reviewStatus}" (注意：这是真实的审核状态值)`);
    console.log(`   ✅ isActive: ${testMarket.isActive}`);
    console.log(`   ✅ isHot: ${testMarket.isHot}`);
    console.log(`   ✅ categoryId: ${testMarket.categories.length > 0 ? testMarket.categories.map(c => c.categoryId).join(', ') : '未关联'}`);
    console.log(`   ✅ templateId: "${testMarket.templateId || 'null'}"`);
    console.log(`   ✅ closingDate 是否过期: ${isClosed ? '是' : '否'}`);
    console.log('');
    console.log('💡 请根据上述真实字段值修改 API 查询条件！');

  } catch (error) {
    console.error('❌ 查询失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 执行诊断
auditManualMarket()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
