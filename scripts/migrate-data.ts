/**
 * 数据库存量数据修复脚本
 * 用于修复 Market 表中的 null 字段和 Invalid Date 问题
 * 
 * 运行方式：
 * npx ts-node scripts/migrate-data.ts
 * 
 * 或者使用 tsx（如果已安装）：
 * npx tsx scripts/migrate-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 修复单个市场记录
 */
async function migrateMarket(market: any) {
  const updates: any = {};
  let hasUpdates = false;

  // 1. 修复 source 字段
  if (market.source === null || market.source === undefined) {
    // 如果有 externalId 和 externalSource，判断为 POLYMARKET
    if (market.externalId && market.externalSource === 'polymarket') {
      updates.source = 'POLYMARKET';
    } else {
      updates.source = 'INTERNAL';
    }
    hasUpdates = true;
  }

  // 2. 修复 isActive 字段
  if (market.isActive === null || market.isActive === undefined) {
    updates.isActive = true;
    hasUpdates = true;
  }

  // 3. 修复 externalVolume 字段
  if (market.externalVolume === null || market.externalVolume === undefined) {
    // 如果是 POLYMARKET 来源，将现有的 totalVolume 赋值给 externalVolume
    const finalSource = updates.source || market.source;
    if (finalSource === 'POLYMARKET') {
      updates.externalVolume = market.totalVolume || 0;
    } else {
      updates.externalVolume = 0;
    }
    hasUpdates = true;
  }

  // 4. 修复 internalVolume 字段
  if (market.internalVolume === null || market.internalVolume === undefined) {
    // 如果是 INTERNAL 来源，将现有的 totalVolume 赋值给 internalVolume
    const finalSource = updates.source || market.source;
    if (finalSource === 'INTERNAL') {
      updates.internalVolume = market.totalVolume || 0;
    } else {
      updates.internalVolume = 0;
    }
    hasUpdates = true;
  }

  // 5. 修复 manualOffset 字段
  if (market.manualOffset === null || market.manualOffset === undefined) {
    updates.manualOffset = 0;
    hasUpdates = true;
  }

  // 6. 修复 closingDate（endTime）字段
  let closingDate = market.closingDate;
  if (closingDate) {
    const date = new Date(closingDate);
    // 检查是否为有效日期
    if (isNaN(date.getTime())) {
      console.warn(`⚠️  市场 ID ${market.id} 的 closingDate 无效: ${closingDate}，将设置为 2030-01-01`);
      updates.closingDate = new Date('2030-01-01T00:00:00Z');
      hasUpdates = true;
    }
  } else {
    // 如果 closingDate 为 null，设置为默认未来日期
    updates.closingDate = new Date('2030-01-01T00:00:00Z');
    hasUpdates = true;
  }

  // 如果有更新，执行更新操作
  if (hasUpdates) {
    try {
      await prisma.market.update({
        where: { id: market.id },
        data: updates,
      });
      return true;
    } catch (error) {
      console.error(`❌ 更新市场失败 (ID: ${market.id}):`, error);
      return false;
    }
  }

  return false;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 [Migration] ========== 开始数据库存量数据修复 ==========');
    console.log('📊 [Migration] 正在查询所有市场记录...');

    // 查询所有市场记录（包括 isActive = false 的记录）
    const allMarkets = await prisma.market.findMany({
      select: {
        id: true,
        title: true,
        source: true,
        isActive: true,
        externalVolume: true,
        internalVolume: true,
        manualOffset: true,
        closingDate: true,
        totalVolume: true,
        externalId: true,
        externalSource: true,
      },
    });

    console.log(`✅ [Migration] 共查询到 ${allMarkets.length} 条市场记录`);

    let fixedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 逐条处理市场记录
    for (let i = 0; i < allMarkets.length; i++) {
      const market = allMarkets[i];
      const progress = `[${i + 1}/${allMarkets.length}]`;

      try {
        const wasFixed = await migrateMarket(market);
        if (wasFixed) {
          fixedCount++;
          console.log(`✅ ${progress} 修复市场: ${market.title?.substring(0, 50) || market.id}`);
        } else {
          skippedCount++;
          if ((i + 1) % 100 === 0) {
            console.log(`⏭️  ${progress} 跳过（无需修复）...`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ ${progress} 处理市场失败 (ID: ${market.id}):`, error);
      }

      // 每处理 100 条记录，输出一次进度
      if ((i + 1) % 100 === 0) {
        console.log(`📊 [Migration] 进度: ${i + 1}/${allMarkets.length} (已修复: ${fixedCount}, 跳过: ${skippedCount}, 错误: ${errorCount})`);
      }
    }

    console.log('');
    console.log('✅ [Migration] ========== 数据库存量数据修复完成 ==========');
    console.log(`📊 [Migration] 统计信息:`);
    console.log(`   - 总记录数: ${allMarkets.length}`);
    console.log(`   - 修复完成: ${fixedCount}`);
    console.log(`   - 跳过（无需修复）: ${skippedCount}`);
    console.log(`   - 错误数量: ${errorCount}`);
    console.log('✅ [Migration] ============================================');

    // 验证修复结果
    console.log('');
    console.log('🔍 [Migration] 正在验证修复结果...');
    
    // 验证修复结果 - 使用原始 SQL 查询 null 值（因为 Prisma 的 null 查询有限制）
    const nullCounts = await prisma.$queryRaw<Array<{
      source_count: bigint;
      isactive_count: bigint;
      externalvolume_count: bigint;
      internalvolume_count: bigint;
      manualoffset_count: bigint;
    }>>`
      SELECT 
        COUNT(*) FILTER (WHERE source IS NULL)::bigint as source_count,
        COUNT(*) FILTER (WHERE "isActive" IS NULL)::bigint as isactive_count,
        COUNT(*) FILTER (WHERE "externalVolume" IS NULL)::bigint as externalvolume_count,
        COUNT(*) FILTER (WHERE "internalVolume" IS NULL)::bigint as internalvolume_count,
        COUNT(*) FILTER (WHERE "manualOffset" IS NULL)::bigint as manualoffset_count
      FROM markets
    `;

    const nullSourceCount = Number(nullCounts[0]?.source_count || 0);
    const nullIsActiveCount = Number(nullCounts[0]?.isactive_count || 0);
    const nullExternalVolumeCount = Number(nullCounts[0]?.externalvolume_count || 0);
    const nullInternalVolumeCount = Number(nullCounts[0]?.internalvolume_count || 0);
    const nullManualOffsetCount = Number(nullCounts[0]?.manualoffset_count || 0);

    console.log('📊 [Migration] 验证结果:');
    console.log(`   - source 为 null 的记录: ${nullSourceCount}`);
    console.log(`   - isActive 为 null 的记录: ${nullIsActiveCount}`);
    console.log(`   - externalVolume 为 null 的记录: ${nullExternalVolumeCount}`);
    console.log(`   - internalVolume 为 null 的记录: ${nullInternalVolumeCount}`);
    console.log(`   - manualOffset 为 null 的记录: ${nullManualOffsetCount}`);

    if (
      nullSourceCount === 0 &&
      nullIsActiveCount === 0 &&
      nullExternalVolumeCount === 0 &&
      nullInternalVolumeCount === 0 &&
      nullManualOffsetCount === 0
    ) {
      console.log('✅ [Migration] 所有字段修复完成，没有 null 值！');
    } else {
      console.warn('⚠️  [Migration] 仍有部分字段为 null，可能需要手动检查');
    }

  } catch (error) {
    console.error('❌ [Migration] 迁移脚本执行失败:');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('✅ [Migration] 数据库连接已关闭');
  }
}

// 执行主函数
main()
  .catch((error) => {
    console.error('❌ [Migration] 未捕获的错误:', error);
    process.exit(1);
  });
