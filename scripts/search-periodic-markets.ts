/**
 * 搜索周期性市场脚本
 * 运行方式: npx tsx scripts/search-periodic-markets.ts
 */

async function searchPeriodicMarkets() {
  try {
    console.log('🔍 搜索周期性市场...\n');
    
    // 搜索包含 BTC 和 15 分钟的市场
    const queries = [
      'BTC 15',
      'Bitcoin 15',
      'ETH 15',
      'Ethereum 15',
      'BTC minute',
      'ETH minute',
    ];
    
    for (const query of queries) {
      console.log(`\n📡 搜索: "${query}"`);
      const url = `https://gamma-api.polymarket.com/markets?closed=false&limit=50&query=${encodeURIComponent(query)}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (!response.ok) {
          console.log(`  ❌ API 错误: ${response.status}`);
          continue;
        }
        
        const markets = await response.json();
        const marketList = Array.isArray(markets) ? markets : (markets.markets || []);
        
        console.log(`  ✅ 找到 ${marketList.length} 个市场`);
        
        // 打印前5个市场的标题
        console.log(`  前5个市场标题:`);
        marketList.slice(0, 5).forEach((m: any, idx: number) => {
          const title = m.title || m.question || 'N/A';
          console.log(`    ${idx + 1}. ${title.substring(0, 80)}`);
        });
        
        // 过滤出真正包含15分钟的市场
        const periodicMarkets = marketList.filter((m: any) => {
          const title = (m.title || m.question || '').toLowerCase();
          return (title.includes('15') && (title.includes('min') || title.includes('minute'))) ||
                 (title.includes('1h') || (title.includes('1') && title.includes('hour'))) ||
                 (title.includes('1d') || (title.includes('1') && title.includes('day')));
        });
        
        if (periodicMarkets.length > 0) {
          console.log(`\n  🎯 周期性市场: ${periodicMarkets.length} 个`);
          periodicMarkets.slice(0, 5).forEach((m: any) => {
            console.log(`\n    市场 ID: ${m.id}`);
            console.log(`    标题: ${m.title || m.question}`);
            console.log(`    所有字段:`, Object.keys(m).join(', '));
            if (m.tags) {
              console.log(`    tags字段:`, JSON.stringify(m.tags));
              if (Array.isArray(m.tags) && m.tags.length > 0) {
                m.tags.forEach((tag: any, i: number) => {
                  console.log(`      tag[${i}]:`, typeof tag === 'string' ? tag : JSON.stringify(tag));
                });
              }
            } else {
              console.log(`    tags字段: 不存在`);
            }
            console.log(`    group字段:`, m.group || m.group_id || m.groupId || '不存在');
            console.log(`    conditionId:`, m.conditionId || '不存在');
            console.log(`    questionID:`, m.questionID || '不存在');
          });
        } else {
          console.log(`  ⚠️ 未找到周期性市场`);
        }
      } catch (error: any) {
        console.log(`  ❌ 请求失败: ${error.message}`);
      }
    }
    
    console.log('\n✅ 搜索完成！');
  } catch (error) {
    console.error('❌ 搜索失败:', error);
    throw error;
  }
}

searchPeriodicMarkets();
