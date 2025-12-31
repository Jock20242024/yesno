/**
 * 测试市场详情 API，检查赔率数据是否正确返回
 */
import { prisma } from '../lib/prisma';

async function testMarketAPI() {
  try {
    // 查找一个已同步的工厂市场
    const market = await prisma.market.findFirst({
      where: {
        isFactory: true,
        isActive: true,
        closingDate: { gt: new Date() },
        outcomePrices: { not: null },
      },
      select: {
        id: true,
        title: true,
        outcomePrices: true,
        isFactory: true,
        source: true,
        externalId: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!market) {
      console.log('❌ 未找到已同步的工厂市场');
      await prisma.$disconnect();
      return;
    }

    console.log('📊 测试市场:', market.id);
    console.log('标题:', market.title?.substring(0, 50));
    console.log('outcomePrices:', market.outcomePrices);
    
    // 模拟 API 的解析逻辑
    const outcomePrices = market.outcomePrices;
    let yesPercent = 50;
    let noPercent = 50;
    
    if (outcomePrices) {
      try {
        const parsed = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
        console.log('解析后:', parsed);
        
        let yesPrice: number | null = null;
        let noPrice: number | null = null;
        
        if (Array.isArray(parsed) && parsed.length >= 2) {
          yesPrice = parseFloat(String(parsed[0]));
          noPrice = parseFloat(String(parsed[1]));
          console.log('yesPrice:', yesPrice, 'noPrice:', noPrice);
        }
        
        if (yesPrice !== null && !isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
          yesPercent = yesPrice * 100;
          if (noPrice !== null && !isNaN(noPrice) && noPrice >= 0 && noPrice <= 1) {
            noPercent = noPrice * 100;
          } else {
            noPercent = (1 - yesPrice) * 100;
          }
          console.log('✅ 计算后的赔率:');
          console.log(`  yesPercent = ${yesPercent}`);
          console.log(`  noPercent = ${noPercent}`);
        }
      } catch (e) {
        console.error('解析失败:', e);
      }
    }
    
    // 测试最终的计算
    const finalYesPercent = Math.round(yesPercent * 100) / 100;
    const finalNoPercent = Math.round(noPercent * 100) / 100;
    console.log('');
    console.log('📤 最终返回的赔率:');
    console.log(`  yesPercent: ${finalYesPercent}`);
    console.log(`  noPercent: ${finalNoPercent}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 测试失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testMarketAPI();

