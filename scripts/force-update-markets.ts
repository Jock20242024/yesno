/**
 * 强制更新脚本：针对特定 externalId 列表重新抓取并更新数据库
 * 
 * 运行方式: npx tsx scripts/force-update-markets.ts
 */

import { PrismaClient } from '@prisma/client';
import { translateText } from '@/lib/scrapers/translateService';
import { calculateDisplayVolume } from '@/lib/marketUtils';

const prisma = new PrismaClient();

// 要强制更新的 externalId 列表
const EXTERNAL_IDS = ['520630', '924496', '967315', '690531'];

interface PolymarketMarket {
  id: string;
  question?: string;
  title?: string;
  description?: string;
  slug?: string;
  startDate?: string;
  startDateIso?: string;
  endDate?: string;
  endDateIso?: string;
  image?: string;
  icon?: string;
  outcomePrices?: string | string[];
  volume?: string;
  volumeNum?: number;
  volume24hr?: number;
  closed?: boolean;
  events?: Array<{
    id?: string;
    image?: string;
    icon?: string;
    markets?: Array<{
      image?: string;
      icon?: string;
      outcomePrices?: string | string[];
    }>;
  }>;
}

async function fetchMarketFromAPI(externalId: string): Promise<PolymarketMarket | null> {
  try {
    console.log(`📡 从 API 获取市场数据 (External ID: ${externalId})...`);
    
    const url = `https://gamma-api.polymarket.com/markets?closed=false&limit=1000&offset=0&order=volume&ascending=false`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.log('❌ API 返回的数据不是数组');
      return null;
    }

    const market = data.find((m: any) => m.id === externalId);
    
    if (!market) {
      console.log(`⚠️  未找到 External ID 为 ${externalId} 的市场（可能已关闭）`);
      return null;
    }

    return market as PolymarketMarket;
  } catch (error) {
    console.error(`❌ 获取市场数据失败 (External ID: ${externalId}):`, error);
    return null;
  }
}

async function updateMarketFromAPIData(externalId: string, marketData: PolymarketMarket) {
  try {
    console.log(`\n🔄 更新市场 (External ID: ${externalId})...`);

    // 查找现有市场
    const existingMarket = await prisma.market.findFirst({
      where: {
        externalId: externalId,
        externalSource: 'polymarket',
        source: 'POLYMARKET',
      },
    });

    if (!existingMarket) {
      console.log(`⚠️  数据库中未找到 External ID 为 ${externalId} 的市场，跳过更新`);
      return;
    }

    // 提取 outcomePrices
    let outcomePrices: string | string[] | undefined = marketData.outcomePrices;
    
    // 情况1：在 events[0].markets[0].outcomePrices
    if (!outcomePrices && marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
      const firstEvent = marketData.events[0];
      if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
        const firstSubMarket = firstEvent.markets[0];
        outcomePrices = firstSubMarket.outcomePrices;
      }
    }

    if (!outcomePrices) {
      console.log(`⚠️  市场没有 outcomePrices，跳过更新`);
      return;
    }

    // 保存 outcomePrices 原始数据（JSON 字符串格式）
    let outcomePricesJson: string | null = null;
    if (typeof outcomePrices === 'string') {
      outcomePricesJson = outcomePrices;
    } else if (Array.isArray(outcomePrices)) {
      outcomePricesJson = JSON.stringify(outcomePrices);
    }

    // 解析 outcomePrices 计算 initialPrice
    let prices: number[] = [];
    let initialPriceValue: number | null = null;
    
    try {
      if (typeof outcomePrices === 'string') {
        const parsed = JSON.parse(outcomePrices);
        if (Array.isArray(parsed)) {
          prices = parsed.map((p: any) => {
            const num = parseFloat(String(p));
            return isNaN(num) ? 0 : num;
          }).filter((p: number) => p >= 0);
        }
      } else if (Array.isArray(outcomePrices)) {
        prices = outcomePrices.map((p: any) => {
          const num = typeof p === 'string' ? parseFloat(p) : (typeof p === 'number' ? p : 0);
          return isNaN(num) ? 0 : num;
        }).filter((p: number) => p >= 0);
      }
      
      if (prices.length >= 2 && prices[0] >= 0 && prices[1] >= 0) {
        initialPriceValue = prices[0];
      }
    } catch (error) {
      console.warn(`⚠️  解析 outcomePrices 失败:`, error);
    }

    // 提取图片字段
    let imageUrl: string | null = null;
    let iconUrlValue: string | null = null;
    
    // 情况1：直接在 marketData 上
    if (marketData.image) {
      imageUrl = marketData.image;
    } else if ((marketData as any).iconUrl) {
      iconUrlValue = (marketData as any).iconUrl;
    } else if (marketData.icon) {
      iconUrlValue = marketData.icon;
    }
    
    // 情况2：在 events[0] 上
    if (!imageUrl && !iconUrlValue && marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
      const firstEvent = marketData.events[0];
      if (firstEvent.image) {
        imageUrl = firstEvent.image;
      } else if (firstEvent.icon) {
        iconUrlValue = firstEvent.icon;
      }
    }
    
    // 情况3：在 events[0].markets[0] 上
    if (!imageUrl && !iconUrlValue && marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
      const firstEvent = marketData.events[0];
      if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
        const firstSubMarket = firstEvent.markets[0];
        if (firstSubMarket.image) {
          imageUrl = firstSubMarket.image;
        } else if (firstSubMarket.icon) {
          iconUrlValue = firstSubMarket.icon;
        }
      }
    }

    // 计算 volume24h
    const volume24hValue = marketData.volume24hr || (marketData.volumeNum ? marketData.volumeNum : null);

    // 计算交易量
    const totalVolume = marketData.volumeNum || (marketData.volume ? parseFloat(marketData.volume) : 0);
    const externalVolumeValue = typeof totalVolume === 'number' ? totalVolume : parseFloat(String(totalVolume || 0));
    
    const newDisplayVolume = calculateDisplayVolume({
      source: existingMarket.source || 'POLYMARKET',
      externalVolume: externalVolumeValue,
      internalVolume: existingMarket.internalVolume || 0,
      manualOffset: existingMarket.manualOffset || 0,
    });

    // 计算赔率
    let yesProbability = 50;
    let noProbability = 50;
    if (prices.length >= 2 && prices[0] >= 0 && prices[1] >= 0) {
      const yesPrice = prices[0];
      const noPrice = prices[1];
      const total = yesPrice + noPrice;
      if (total > 0) {
        yesProbability = Math.round((yesPrice / total) * 100);
        noProbability = 100 - yesProbability;
      }
    }

    // 更新数据库
    const updateData: any = {
      externalVolume: externalVolumeValue,
      totalVolume: newDisplayVolume,
      yesProbability,
      noProbability,
      isHot: newDisplayVolume > 10000,
      updatedAt: new Date(),
      // 🔥 强制更新原始数据字段
      outcomePrices: outcomePricesJson,
      image: imageUrl,
      iconUrl: iconUrlValue,
      initialPrice: initialPriceValue,
      volume24h: volume24hValue,
    };

    await prisma.market.update({
      where: { id: existingMarket.id },
      data: updateData,
    });

    console.log(`✅ 市场更新成功 (数据库 ID: ${existingMarket.id})`);
    console.log(`   - Image: ${imageUrl || iconUrlValue || 'NULL'}`);
    console.log(`   - OutcomePrices: ${outcomePricesJson ? '✅ 有数据' : 'NULL'}`);
    console.log(`   - InitialPrice: ${initialPriceValue !== null ? initialPriceValue : 'NULL'}`);
    console.log(`   - Volume24h: ${volume24hValue || 'NULL'}`);

  } catch (error) {
    console.error(`❌ 更新市场失败 (External ID: ${externalId}):`, error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
}

async function main() {
  console.log('🚀 ========== 强制更新市场数据 ==========');
  console.log(`⏰ 开始时间: ${new Date().toISOString()}`);
  console.log(`📋 要更新的 External ID 列表: ${EXTERNAL_IDS.join(', ')}\n`);

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const externalId of EXTERNAL_IDS) {
    try {
      const marketData = await fetchMarketFromAPI(externalId);
      
      if (!marketData) {
        notFoundCount++;
        continue;
      }

      await updateMarketFromAPIData(externalId, marketData);
      successCount++;
      
      // 添加延迟，避免 API 限流
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ 处理失败 (External ID: ${externalId}):`, error);
      errorCount++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 更新结果统计:');
  console.log(`   ✅ 成功更新: ${successCount}`);
  console.log(`   ⚠️  API 中未找到: ${notFoundCount}`);
  console.log(`   ❌ 更新失败: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 验证更新结果
  console.log('🔍 验证更新结果...\n');
  const updatedMarkets = await prisma.market.findMany({
    where: {
      externalId: { in: EXTERNAL_IDS },
      externalSource: 'polymarket',
      source: 'POLYMARKET',
    },
    select: {
      id: true,
      title: true,
      externalId: true,
      image: true,
      iconUrl: true,
      outcomePrices: true,
      initialPrice: true,
      volume24h: true,
    },
  });

  updatedMarkets.forEach(market => {
    console.log(`市场: ${market.title}`);
    console.log(`  External ID: ${market.externalId}`);
    console.log(`  Image: ${market.image || '❌ NULL'}`);
    console.log(`  OutcomePrices: ${market.outcomePrices ? '✅ 有数据' : '❌ NULL'}`);
    console.log(`  InitialPrice: ${market.initialPrice !== null ? market.initialPrice : '❌ NULL'}`);
    console.log(`  Volume24h: ${market.volume24h || '❌ NULL'}`);
    console.log('');
  });

  console.log(`⏰ 结束时间: ${new Date().toISOString()}`);
  console.log('✅ ========== 强制更新完成 ==========\n');
}

main()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
