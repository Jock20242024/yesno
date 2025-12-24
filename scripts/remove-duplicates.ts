/**
 * 🔍 清理重复的工厂市场（Remove Duplicates）
 * 
 * 目的：找出所有重复生成的工厂市场，保留ID最新的一个，删掉旧的
 * 
 * 去重逻辑：
 * - 基于 templateId + closingDate（相同模板、相同结束时间的市场视为重复）
 * - 对于每个重复组，保留 createdAt 最新的（或 id 最新的）市场，删除其他
 * 
 * 使用方法：
 * npx tsx scripts/remove-duplicates.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function removeDuplicates() {
  try {
    console.log('\n🔍 ===========================================');
    console.log('🔍 清理重复的工厂市场');
    console.log('🔍 ===========================================\n');

    // 步骤1：查询所有工厂市场
    console.log('📋 步骤1：查询所有工厂市场...\n');
    
    const allFactoryMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        templateId: { not: null },
      },
      select: {
        id: true,
        templateId: true,
        closingDate: true,
        createdAt: true,
        title: true,
        status: true,
      },
      orderBy: {
        createdAt: 'desc', // 按创建时间降序，新的在前
      },
    });

    console.log(`✅ 找到 ${allFactoryMarkets.length} 个工厂市场\n`);

    if (allFactoryMarkets.length === 0) {
      console.log('✅ 没有工厂市场，无需清理');
      await prisma.$disconnect();
      return;
    }

    // 步骤2：按 templateId + closingDate 分组，找出重复
    console.log('📋 步骤2：分析重复市场...\n');
    
    // 使用 Map 来存储每个 (templateId, closingDate) 的市场列表
    const marketGroups = new Map<string, typeof allFactoryMarkets>();
    
    for (const market of allFactoryMarkets) {
      if (!market.templateId) continue;
      
      // 创建唯一键：templateId + closingDate（精确到秒，去除毫秒差异）
      const closingDateRounded = new Date(market.closingDate);
      closingDateRounded.setMilliseconds(0);
      const key = `${market.templateId}_${closingDateRounded.toISOString()}`;
      
      if (!marketGroups.has(key)) {
        marketGroups.set(key, []);
      }
      marketGroups.get(key)!.push(market);
    }

    // 步骤3：找出有重复的组（超过1个市场的组）
    const duplicateGroups: Array<{ key: string; markets: typeof allFactoryMarkets }> = [];
    
    for (const [key, markets] of marketGroups.entries()) {
      if (markets.length > 1) {
        duplicateGroups.push({ key, markets });
      }
    }

    console.log(`📊 统计结果：`);
    console.log(`   总市场数: ${allFactoryMarkets.length}`);
    console.log(`   唯一组数: ${marketGroups.size}`);
    console.log(`   重复组数: ${duplicateGroups.length}`);
    
    if (duplicateGroups.length === 0) {
      console.log('\n✅ 没有发现重复市场，无需清理');
      await prisma.$disconnect();
      return;
    }

    // 计算需要删除的市场总数
    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.markets.length - 1), 0);
    console.log(`   需要删除的重复市场数: ${totalDuplicates}\n`);

    // 步骤4：显示重复详情
    console.log('📋 步骤3：重复市场详情...\n');
    
    for (const group of duplicateGroups.slice(0, 10)) { // 只显示前10个
      const [templateId, closingDateStr] = group.key.split('_');
      console.log(`   重复组: templateId=${templateId}, closingDate=${closingDateStr}`);
      console.log(`     市场数: ${group.markets.length}`);
      for (const market of group.markets) {
        console.log(`       - ID: ${market.id.substring(0, 8)}..., 创建时间: ${market.createdAt.toISOString()}, 状态: ${market.status}`);
      }
      console.log('');
    }
    
    if (duplicateGroups.length > 10) {
      console.log(`   ... 还有 ${duplicateGroups.length - 10} 个重复组未显示\n`);
    }

    // 步骤5：执行删除（保留每个组中第一个，删除其他）
    console.log('📋 步骤4：执行删除操作...\n');
    
    let deletedCount = 0;
    const marketsToDelete: string[] = [];
    
    for (const group of duplicateGroups) {
      // 按 createdAt 降序排列（已经在查询时排序，第一个是最新的）
      // 保留第一个（最新的），删除其他
      const toKeep = group.markets[0];
      const toDelete = group.markets.slice(1);
      
      console.log(`   保留: ${toKeep.id.substring(0, 8)}... (创建于 ${toKeep.createdAt.toISOString()})`);
      for (const market of toDelete) {
        console.log(`   删除: ${market.id.substring(0, 8)}... (创建于 ${market.createdAt.toISOString()})`);
        marketsToDelete.push(market.id);
        deletedCount++;
      }
    }

    if (marketsToDelete.length === 0) {
      console.log('\n✅ 没有需要删除的市场');
      await prisma.$disconnect();
      return;
    }

    console.log(`\n⚠️  准备删除 ${marketsToDelete.length} 个重复市场`);
    console.log('⚠️  开始执行删除操作...\n');

    // 执行删除
    const deleteResult = await prisma.market.deleteMany({
      where: {
        id: { in: marketsToDelete },
      },
    });

    console.log(`✅ 成功删除 ${deleteResult.count} 个重复市场\n`);

    // 步骤6：验证清理结果
    console.log('📋 步骤5：验证清理结果...\n');
    
    const remainingMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        templateId: { not: null },
      },
      select: {
        id: true,
        templateId: true,
        closingDate: true,
      },
    });

    // 再次检查是否还有重复
    const remainingGroups = new Map<string, number>();
    for (const market of remainingMarkets) {
      if (!market.templateId) continue;
      const closingDateRounded = new Date(market.closingDate);
      closingDateRounded.setMilliseconds(0);
      const key = `${market.templateId}_${closingDateRounded.toISOString()}`;
      remainingGroups.set(key, (remainingGroups.get(key) || 0) + 1);
    }

    const remainingDuplicates = Array.from(remainingGroups.values()).filter(count => count > 1).length;
    
    console.log(`   清理后市场总数: ${remainingMarkets.length}`);
    console.log(`   剩余重复组数: ${remainingDuplicates}`);
    
    if (remainingDuplicates === 0) {
      console.log('\n✅ 清理完成，没有发现剩余的重复市场');
    } else {
      console.log('\n⚠️  警告：仍然存在重复市场，可能需要再次运行清理脚本');
    }

    console.log('\n🔍 ===========================================');
    console.log('🔍 清理完成');
    console.log('🔍 ===========================================\n');

  } catch (error: any) {
    console.error('\n❌ 清理过程中发生错误:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
removeDuplicates().catch(console.error);
