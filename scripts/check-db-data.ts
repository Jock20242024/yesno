/**
 * 临时脚本：检查数据库中 Polymarket 市场的真实数据
 * 检查 outcomePrices, image, iconUrl, volume 等字段是否真的存入了数据库
 * 
 * 运行方式: npx tsx scripts/check-db-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检查数据库中 Polymarket 市场的真实数据...\n');

  try {
    // 查询所有从 Polymarket 爬取的市场
    const polymarketMarkets = await prisma.market.findMany({
      where: {
        source: 'POLYMARKET',
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        source: true,
        externalId: true,
        externalVolume: true,
        internalVolume: true,
        totalVolume: true,
        totalYes: true,
        totalNo: true,
        // 尝试读取可能存在的字段（即使 schema 中没有定义）
        // 使用 raw query 或者直接读取所有字段
      },
      take: 10, // 先取 10 个，然后随机选 5 个
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 找到 ${polymarketMarkets.length} 个 POLYMARKET 来源的市场\n`);

    if (polymarketMarkets.length === 0) {
      console.log('❌ 数据库中没有 POLYMARKET 来源的市场！');
      console.log('💡 请先运行爬虫脚本抓取数据');
      return;
    }

    // 随机选择 5 个市场
    const selectedMarkets = polymarketMarkets
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    console.log(`🎲 随机选择了 ${selectedMarkets.length} 个市场进行检查:\n`);

      // 检查数据库表结构
      console.log('🔍 检查数据库表结构...\n');
      try {
        const tableInfo = await prisma.$queryRaw<Array<any>>`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'markets'
          AND column_name IN ('outcomePrices', 'image', 'iconUrl', 'initialPrice')
          ORDER BY column_name
        `;
        
        if (tableInfo.length > 0) {
          console.log('📋 找到以下字段:');
          tableInfo.forEach((col: any) => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
          });
          console.log('');
        } else {
          console.log('❌ 数据库表中没有 outcomePrices, image, iconUrl, initialPrice 字段！');
          console.log('💡 这些字段可能根本没有被创建到数据库中。\n');
        }
      } catch (e) {
        console.log('⚠️  无法检查表结构:', e);
        console.log('');
      }

      // 使用 raw query 读取所有字段（包括可能不在 schema 中定义的字段）
      for (let i = 0; i < selectedMarkets.length; i++) {
        const market = selectedMarkets[i];
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`市场 #${i + 1}: ${market.title}`);
        console.log(`ID: ${market.id}`);
        console.log(`External ID: ${market.externalId || 'NULL'}`);
        console.log(`Source: ${market.source}`);
        console.log('');

        // 尝试使用 raw query 读取所有可能的字段
        try {
          const rawMarket = await prisma.$queryRaw<Array<any>>`
            SELECT *
            FROM markets
            WHERE id = ${market.id}
          `;

          if (rawMarket && rawMarket[0]) {
            const data = rawMarket[0];
            console.log('📋 数据库原始字段值:');
            
            // 检查 outcomePrices
            const outcomePrices = data.outcomePrices || data.outcome_prices || data.outcomeprices;
            console.log(`  outcomePrices: ${outcomePrices !== null && outcomePrices !== undefined ? JSON.stringify(outcomePrices) : '❌ NULL 或字段不存在'}`);
            
            // 检查 image
            const image = data.image || data.image_url || data.imageUrl;
            console.log(`  image: ${image !== null && image !== undefined && image !== '' ? JSON.stringify(image) : '❌ NULL 或字段不存在'}`);
            
            // 检查 iconUrl
            const iconUrl = data.iconUrl || data.icon_url || data.iconurl;
            console.log(`  iconUrl: ${iconUrl !== null && iconUrl !== undefined && iconUrl !== '' ? JSON.stringify(iconUrl) : '❌ NULL 或字段不存在'}`);
            
            // 检查 initialPrice
            const initialPrice = data.initialPrice || data.initial_price || data.initialprice;
            console.log(`  initialPrice: ${initialPrice !== null && initialPrice !== undefined ? initialPrice : '❌ NULL 或字段不存在'}`);
            
            console.log(`  externalVolume: ${data.externalVolume ?? 'NULL'}`);
            console.log(`  internalVolume: ${data.internalVolume ?? 'NULL'}`);
            console.log(`  totalVolume: ${data.totalVolume ?? 'NULL'}`);
            console.log(`  totalYes: ${data.totalYes ?? 'NULL'}`);
            console.log(`  totalNo: ${data.totalNo ?? 'NULL'}`);
            console.log('');

            // 计算 volume（优先使用 externalVolume）
            const volume = data.externalVolume || data.totalVolume || data.internalVolume || 0;
            console.log(`💰 计算后的 volume: ${volume}`);
            console.log('');

            // 检查关键字段是否为空
            const hasOutcomePrices = outcomePrices !== null && outcomePrices !== undefined && outcomePrices !== '';
            const hasImage = image !== null && image !== undefined && image !== '';
            const hasIconUrl = iconUrl !== null && iconUrl !== undefined && iconUrl !== '';
            const hasInitialPrice = initialPrice !== null && initialPrice !== undefined;
            const hasVolume = volume > 0;

            console.log('✅ 字段存在性检查:');
            console.log(`  outcomePrices: ${hasOutcomePrices ? '✅ 有数据' : '❌ 为空或不存在'}`);
            console.log(`  image: ${hasImage ? '✅ 有数据' : '❌ 为空或不存在'}`);
            console.log(`  iconUrl: ${hasIconUrl ? '✅ 有数据' : '❌ 为空或不存在'}`);
            console.log(`  initialPrice: ${hasInitialPrice ? '✅ 有数据' : '❌ 为空或不存在'}`);
            console.log(`  volume: ${hasVolume ? '✅ 有数据' : '❌ 为 0'}`);
            console.log('');
          }
        } catch (error: any) {
          console.log('❌ 无法读取原始数据:', error.message);
          console.log('📋 使用 Prisma 查询的字段:');
          console.log(`  externalVolume: ${market.externalVolume ?? 'NULL'}`);
          console.log(`  internalVolume: ${market.internalVolume ?? 'NULL'}`);
          console.log(`  totalVolume: ${market.totalVolume ?? 'NULL'}`);
          console.log(`  totalYes: ${market.totalYes ?? 'NULL'}`);
          console.log(`  totalNo: ${market.totalNo ?? 'NULL'}`);
          console.log('');
        }
      }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 总结:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 统计字段存在情况
    let hasOutcomePricesCount = 0;
    let hasImageCount = 0;
    let hasIconUrlCount = 0;
    let hasInitialPriceCount = 0;
    let hasVolumeCount = 0;
    
    // 重新检查所有选中的市场
    for (const market of selectedMarkets) {
      try {
        const rawMarket = await prisma.$queryRaw<Array<any>>`
          SELECT *
          FROM markets
          WHERE id = ${market.id}
        `;
        
        if (rawMarket && rawMarket[0]) {
          const data = rawMarket[0];
          const outcomePrices = data.outcomePrices || data.outcome_prices || data.outcomeprices;
          const image = data.image || data.image_url || data.imageUrl;
          const iconUrl = data.iconUrl || data.icon_url || data.iconurl;
          const initialPrice = data.initialPrice || data.initial_price || data.initialprice;
          const volume = data.externalVolume || data.totalVolume || data.internalVolume || 0;
          
          if (outcomePrices !== null && outcomePrices !== undefined && outcomePrices !== '') hasOutcomePricesCount++;
          if (image !== null && image !== undefined && image !== '') hasImageCount++;
          if (iconUrl !== null && iconUrl !== undefined && iconUrl !== '') hasIconUrlCount++;
          if (initialPrice !== null && initialPrice !== undefined) hasInitialPriceCount++;
          if (volume > 0) hasVolumeCount++;
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    const total = selectedMarkets.length;
    console.log(`✅ 字段存在情况统计（共检查 ${total} 个市场）:`);
    console.log(`  outcomePrices: ${hasOutcomePricesCount}/${total} (${hasOutcomePricesCount === total ? '✅ 全部有数据' : hasOutcomePricesCount > 0 ? '⚠️ 部分有数据' : '❌ 全部为空'})`);
    console.log(`  image: ${hasImageCount}/${total} (${hasImageCount === total ? '✅ 全部有数据' : hasImageCount > 0 ? '⚠️ 部分有数据' : '❌ 全部为空'})`);
    console.log(`  iconUrl: ${hasIconUrlCount}/${total} (${hasIconUrlCount === total ? '✅ 全部有数据' : hasIconUrlCount > 0 ? '⚠️ 部分有数据' : '❌ 全部为空'})`);
    console.log(`  initialPrice: ${hasInitialPriceCount}/${total} (${hasInitialPriceCount === total ? '✅ 全部有数据' : hasInitialPriceCount > 0 ? '⚠️ 部分有数据' : '❌ 全部为空'})`);
    console.log(`  volume: ${hasVolumeCount}/${total} (${hasVolumeCount === total ? '✅ 全部有数据' : hasVolumeCount > 0 ? '⚠️ 部分有数据' : '❌ 全部为空'})`);
    console.log('');
    
    if (hasOutcomePricesCount === total && hasImageCount === total && hasInitialPriceCount === total) {
      console.log('🎉 成功！所有关键字段都已成功写入数据库！');
      console.log('✅ 数据库结构已更新');
      console.log('✅ 爬虫脚本已修改并成功保存数据');
      console.log('✅ 前端组件现在可以读取真实数据了');
    } else {
      console.log('⚠️ 部分字段仍有缺失，可能需要再次运行抓取脚本');
    }
    console.log('');

  } catch (error) {
    console.error('❌ 检查失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
