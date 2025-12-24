/**
 * 检查特定市场在 Polymarket API 中的原始数据
 * 用于验证 API 是否真的返回了 image 字段
 * 
 * 运行方式: npx tsx scripts/check-polymarket-api.ts
 */

async function main() {
  console.log('🔍 检查 Polymarket API 原始数据...\n');

  // 要检查的市场 External ID
  const externalIds = ['520630', '924496', '967315', '690531'];

  for (const externalId of externalIds) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`检查市场 External ID: ${externalId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      // 调用 Polymarket API
      const url = `https://gamma-api.polymarket.com/markets?closed=false&limit=1000&offset=0&order=volume&ascending=false`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.log('❌ API 返回的数据不是数组');
        continue;
      }

      // 查找匹配的市场
      const market = data.find((m: any) => m.id === externalId);

      if (!market) {
        console.log(`⚠️  未找到 External ID 为 ${externalId} 的市场`);
        console.log(`   可能原因：市场已关闭或不在当前 API 返回列表中\n`);
        continue;
      }

      console.log('✅ 找到市场数据:');
      console.log(`   ID: ${market.id}`);
      console.log(`   Title: ${market.question || market.title || 'N/A'}`);
      console.log(`   Image: ${market.image || '❌ NULL'}`);
      console.log(`   Icon: ${market.icon || '❌ NULL'}`);
      console.log(`   OutcomePrices: ${market.outcomePrices || '❌ NULL'}`);
      
      // 检查 events 数组
      if (market.events && Array.isArray(market.events) && market.events.length > 0) {
        const firstEvent = market.events[0];
        console.log(`   Events[0].Image: ${firstEvent.image || '❌ NULL'}`);
        console.log(`   Events[0].Icon: ${firstEvent.icon || '❌ NULL'}`);
        
        if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
          const firstSubMarket = firstEvent.markets[0];
          console.log(`   Events[0].Markets[0].Image: ${firstSubMarket.image || '❌ NULL'}`);
          console.log(`   Events[0].Markets[0].Icon: ${firstSubMarket.icon || '❌ NULL'}`);
        }
      }

      // 检查是否有 volume 数据
      console.log(`   Volume: ${market.volume || market.volumeNum || '❌ NULL'}`);
      console.log(`   Volume24hr: ${market.volume24hr || '❌ NULL'}`);

      // 输出完整的原始数据结构（仅关键字段）
      console.log('\n📋 完整数据结构（关键字段）:');
      console.log(JSON.stringify({
        id: market.id,
        question: market.question,
        image: market.image,
        icon: market.icon,
        outcomePrices: market.outcomePrices,
        volume: market.volume || market.volumeNum,
        volume24hr: market.volume24hr,
        events: market.events ? market.events.map((e: any) => ({
          id: e.id,
          image: e.image,
          icon: e.icon,
          markets: e.markets ? e.markets.map((m: any) => ({
            image: m.image,
            icon: m.icon,
          })) : null,
        })) : null,
      }, null, 2));

      console.log('');

    } catch (error) {
      console.error(`❌ 检查失败 (External ID: ${externalId}):`, error);
      if (error instanceof Error) {
        console.error('错误消息:', error.message);
      }
      console.log('');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 检查完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
