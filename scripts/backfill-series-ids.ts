/**
 * 回填脚本：为所有缺少 seriesId 的模板补全 Polymarket Series ID
 * 
 * 使用方法:
 *   npx tsx scripts/backfill-series-ids.ts
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
    const periodKeywords = period === 15 ? ['15', '15m', '15-minute', '15 minute', 'minute'] :
                           period === 60 ? ['hourly', '1h', 'hour', '1 hour'] :
                           period === 240 ? ['4h', '4-hour', '4 hour'] :
                           period === 1440 ? ['daily', 'day'] :
                           period === 10080 ? ['weekly', 'week'] :
                           period === 43200 ? ['monthly', 'month'] : [];
    
    // 对于15分钟周期，还需要检查系列ID或slug中是否包含15
    const check15MinuteById = period === 15;

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
      const seriesIdStr = String(s.id || '');
      
      // 检查资产符号
      const hasAsset = title.includes(assetSymbol) || 
                       (assetSymbol === 'btc' && (title.includes('bitcoin') || title.includes('btc'))) ||
                       (assetSymbol === 'eth' && (title.includes('ethereum') || title.includes('eth'))) ||
                       (assetSymbol === 'sol' && (title.includes('solana') || title.includes('sol'))) ||
                       (assetSymbol === 'link' && (title.includes('chainlink') || title.includes('link'))) ||
                       (assetSymbol === 'doge' && (title.includes('dogecoin') || title.includes('doge'))) ||
                       (assetSymbol === 'avax' && (title.includes('avalanche') || title.includes('avax'))) ||
                       (assetSymbol === 'ada' && (title.includes('cardano') || title.includes('ada')));
      
      if (!hasAsset) {
        return false;
      }
      
      // 检查周期关键词
      const hasPeriod = periodKeywords.some(kw => title.includes(kw.toLowerCase()));
      
      // 对于15分钟周期，也检查系列ID是否匹配已知的15分钟系列ID
      // 常见的15分钟系列ID模式：10192 (BTC 15m), 10239 (ETH 15m) 等
      if (check15MinuteById && !hasPeriod) {
        // 如果标题中没有明确的周期关键词，但系列ID在已知范围内，也认为是匹配的
        // 这里可以添加已知的15分钟系列ID列表
        const known15mSeriesIds = ['10192', '10240', '10241']; // 可以根据实际情况扩展
        if (known15mSeriesIds.includes(seriesIdStr)) {
          return true;
        }
      }
      
      return hasPeriod;
    });

    if (matchedSeries && matchedSeries.id) {
      return String(matchedSeries.id);
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
  console.log('🚀 [Backfill] 开始回填模板的 seriesId...\n');

  try {
    // 查找所有缺少seriesId的模板
    const templates = await prisma.marketTemplate.findMany({
      where: {
        OR: [
          { seriesId: null },
          { seriesId: '' },
        ],
      },
      select: {
        id: true,
        symbol: true,
        period: true,
        type: true,
        name: true,
      },
    });

    console.log(`📊 [Backfill] 找到 ${templates.length} 个缺少 seriesId 的模板\n`);

    if (templates.length === 0) {
      console.log('✅ [Backfill] 所有模板都已包含 seriesId，无需回填');
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const template of templates) {
      console.log(`\n🔄 [Backfill] 处理模板: ${template.symbol} ${template.period}分钟 ${template.type}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   名称: ${template.name?.substring(0, 60)}...`);

      const seriesId = await findSeriesId(template.symbol, template.period);

      if (seriesId) {
        try {
          await prisma.marketTemplate.update({
            where: { id: template.id },
            data: { seriesId },
          });
          console.log(`   ✅ 成功回填 seriesId: ${seriesId}`);
          successCount++;
        } catch (error: any) {
          console.error(`   ❌ 更新数据库失败:`, error.message);
          failedCount++;
        }
      } else {
        console.warn(`   ⚠️ 未找到匹配的 seriesId`);
        failedCount++;
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ [Backfill] 回填完成:`);
    console.log(`   成功: ${successCount}`);
    console.log(`   失败: ${failedCount}`);
    console.log(`   总计: ${templates.length}`);

  } catch (error: any) {
    console.error('❌ [Backfill] 回填过程出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
main().catch((error) => {
  console.error('❌ [Backfill] 脚本执行失败:', error);
  process.exit(1);
});
