/**
 * 强制回填脚本：为所有模板强制补全 Polymarket Series ID
 * 
 * 使用方法:
 *   npx tsx scripts/force-backfill.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Series {
  id: number | string;
  title: string;
  slug?: string;
}

/**
 * 从Polymarket API查找匹配的Series ID
 */
async function findSeriesId(symbol: string, period: number): Promise<string | null> {
  try {
    const assetSymbol = symbol.split('/')[0].toLowerCase(); // BTC/USD -> btc
    
    // 周期关键词映射（扩展匹配模式）
    const periodKeywords = period === 15 ? ['15', '15m', '15-minute', '15 minute', 'up or down 15'] :
                           period === 60 ? ['hourly', '1h', 'hour', '1 hour', 'up or down hourly'] :
                           period === 240 ? ['4h', '4-hour', '4 hour', 'up or down 4h'] :
                           period === 1440 ? ['daily', 'day', 'up or down daily'] :
                           period === 10080 ? ['weekly', 'week', 'up or down weekly'] :
                           period === 43200 ? ['monthly', 'month', 'up or down monthly'] : [];

    if (periodKeywords.length === 0) {
      console.warn(`  ⚠️ 未知周期: ${period}分钟`);
      return null;
    }

    // 请求所有系列
    const seriesUrl = `https://gamma-api.polymarket.com/series?limit=1000`;
    const response = await fetch(seriesUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`  ❌ API请求失败: ${response.status}`);
      return null;
    }

    const allSeries = await response.json();
    const seriesList: Series[] = Array.isArray(allSeries) ? allSeries : (allSeries.series || []);

    // 匹配系列
    const matchedSeries = seriesList.find((s: Series) => {
      const title = ((s.title || '') + ' ' + (s.slug || '')).toLowerCase();
      
      // 检查资产符号（扩展匹配）
      const hasAsset = title.includes(assetSymbol) || 
                       (assetSymbol === 'btc' && (title.includes('bitcoin') || title.includes('btc'))) ||
                       (assetSymbol === 'eth' && (title.includes('ethereum') || title.includes('eth'))) ||
                       (assetSymbol === 'sol' && (title.includes('solana') || title.includes('sol'))) ||
                       (assetSymbol === 'link' && (title.includes('chainlink') || title.includes('link'))) ||
                       (assetSymbol === 'doge' && (title.includes('dogecoin') || title.includes('doge'))) ||
                       (assetSymbol === 'avax' && (title.includes('avalanche') || title.includes('avax'))) ||
                       (assetSymbol === 'ada' && (title.includes('cardano') || title.includes('ada'))) ||
                       (assetSymbol === 'bnb' && (title.includes('binance') || title.includes('bnb') || title.includes('airbnb'))) ||
                       (assetSymbol === 'xrp' && (title.includes('ripple') || title.includes('xrp'))) ||
                       (assetSymbol === 'fil' && (title.includes('filecoin') || title.includes('fil')));
      
      if (!hasAsset) {
        return false;
      }
      
      // 检查周期关键词
      const hasPeriod = periodKeywords.some(kw => title.includes(kw.toLowerCase()));
      
      return hasPeriod;
    });

    if (matchedSeries && matchedSeries.id) {
      return String(matchedSeries.id);
    }

    // 如果没找到，尝试使用已知的映射
    const knownMapping: { [key: string]: string } = {
      'BTC/USD-15': '10192', // BTC Up or Down 15m
      'ETH/USD-15': '10240', // ETH Up or Down 15m
      'SOL/USD-15': '10241', // SOL Up or Down 15m
      'BTC/USD-60': '10114', // BTC Up or Down Hourly
      'ETH/USD-60': '10114', // ETH Hourly (可能和BTC共用，需要确认)
    };
    
    const mappingKey = `${symbol}-${period}`;
    if (knownMapping[mappingKey]) {
      console.log(`  📌 使用已知映射: ${mappingKey} -> ${knownMapping[mappingKey]}`);
      return knownMapping[mappingKey];
    }

    return null;
  } catch (error: any) {
    console.error(`  ❌ 查找Series ID失败:`, error.message);
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 [ForceBackfill] 开始强制回填所有模板的 seriesId...\n');

  try {
    // 查找所有模板
    const templates = await prisma.marketTemplate.findMany({
      select: {
        id: true,
        symbol: true,
        period: true,
        type: true,
        name: true,
        seriesId: true,
      },
      orderBy: [
        { symbol: 'asc' },
        { period: 'asc' },
      ],
    });

    console.log(`📊 [ForceBackfill] 找到 ${templates.length} 个模板\n`);

    if (templates.length === 0) {
      console.log('⚠️ [ForceBackfill] 没有找到任何模板');
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const template of templates) {
      const key = `${template.symbol} ${template.period}分钟 ${template.type}`;
      console.log(`\n🔄 [ForceBackfill] 处理模板: ${key}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   当前seriesId: ${template.seriesId || 'NULL'}`);
      console.log(`   名称: ${template.name?.substring(0, 60)}...`);

      // 如果已有seriesId，询问是否覆盖
      if (template.seriesId) {
        console.log(`   ℹ️  模板已有seriesId，将尝试查找更准确的匹配...`);
      }

      const seriesId = await findSeriesId(template.symbol, template.period);

      if (seriesId) {
        try {
          await prisma.marketTemplate.update({
            where: { id: template.id },
            data: { seriesId },
          });
          console.log(`   ✅ 成功设置 seriesId: ${seriesId}`);
          successCount++;
        } catch (error: any) {
          console.error(`   ❌ 更新数据库失败:`, error.message);
          if (error.code) {
            console.error(`      Prisma错误代码: ${error.code}`);
          }
          failedCount++;
        }
      } else {
        console.warn(`   ⚠️ 未找到匹配的 seriesId`);
        if (template.seriesId) {
          console.log(`   ℹ️  保持原有seriesId: ${template.seriesId}`);
          skippedCount++;
        } else {
          failedCount++;
        }
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ [ForceBackfill] 回填完成:`);
    console.log(`   成功: ${successCount}`);
    console.log(`   跳过（已有seriesId且未找到更优匹配）: ${skippedCount}`);
    console.log(`   失败: ${failedCount}`);
    console.log(`   总计: ${templates.length}`);

  } catch (error: any) {
    console.error('❌ [ForceBackfill] 回填过程出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
main().catch((error) => {
  console.error('❌ [ForceBackfill] 脚本执行失败:', error);
  process.exit(1);
});
