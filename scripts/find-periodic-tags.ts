/**
 * 查找周期性市场的标签ID
 * 运行方式: npx tsx scripts/find-periodic-tags.ts
 */

async function findPeriodicTags() {
  try {
    console.log('🔍 查找周期性市场的标签ID...\n');
    
    // 1. 获取所有标签
    console.log('📋 步骤1: 获取所有标签...');
    const tagsResponse = await fetch('https://gamma-api.polymarket.com/tags', {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!tagsResponse.ok) {
      throw new Error(`Tags API error: ${tagsResponse.status}`);
    }
    
    const tags = await tagsResponse.json();
    console.log(`✅ 获取到 ${tags.length} 个标签\n`);
    
    // 查找相关的标签
    const relevantTags = tags.filter((tag: any) => {
      const label = (tag.label || '').toLowerCase();
      const slug = (tag.slug || '').toLowerCase();
      return (
        label.includes('bitcoin') || label.includes('btc') ||
        label.includes('ethereum') || label.includes('eth') ||
        label.includes('15') || label.includes('minute') || label.includes('min') ||
        label.includes('hour') || label.includes('daily') ||
        slug.includes('bitcoin') || slug.includes('btc') ||
        slug.includes('ethereum') || slug.includes('eth') ||
        slug.includes('15') || slug.includes('minute') || slug.includes('min') ||
        slug.includes('hour') || slug.includes('daily')
      );
    });
    
    console.log('🎯 找到相关标签:');
    relevantTags.forEach((tag: any) => {
      console.log(`  ID: ${tag.id}, Label: ${tag.label}, Slug: ${tag.slug}`);
    });
    
    // 2. 使用标签ID查询市场
    if (relevantTags.length > 0) {
      console.log('\n📡 步骤2: 使用标签ID查询市场...');
      
      for (const tag of relevantTags.slice(0, 5)) {
        console.log(`\n  使用标签 "${tag.label}" (ID: ${tag.id}) 查询市场...`);
        const url = `https://gamma-api.polymarket.com/markets?closed=false&limit=50&tag_id=${tag.id}`;
        
        try {
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (!response.ok) {
            console.log(`    ❌ API错误: ${response.status}`);
            continue;
          }
          
          const markets = await response.json();
          const marketList = Array.isArray(markets) ? markets : (markets.markets || []);
          
          console.log(`    ✅ 找到 ${marketList.length} 个市场`);
          
          // 查找周期性市场
          const periodicMarkets = marketList.filter((m: any) => {
            const title = ((m.title || m.question || '')).toLowerCase();
            return (title.includes('15') && (title.includes('min') || title.includes('minute'))) ||
                   (title.includes('1h') || (title.includes('1') && title.includes('hour'))) ||
                   (title.includes('1d') || (title.includes('1') && title.includes('day')));
          });
          
          if (periodicMarkets.length > 0) {
            console.log(`    🎯 周期性市场: ${periodicMarkets.length} 个`);
            periodicMarkets.slice(0, 3).forEach((m: any) => {
              console.log(`      - ${m.title || m.question}`);
            });
          }
        } catch (error: any) {
          console.log(`    ❌ 请求失败: ${error.message}`);
        }
      }
    }
    
    // 3. 直接搜索包含"15"和"min"的市场（扩大搜索范围）
    console.log('\n📡 步骤3: 直接搜索周期性市场（扩大范围）...');
    const searchUrl = 'https://gamma-api.polymarket.com/markets?closed=false&limit=500&order=volume&ascending=false';
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Markets API error: ${response.status}`);
      }
      
      const markets = await response.json();
      const marketList = Array.isArray(markets) ? markets : (markets.markets || []);
      
      console.log(`✅ 获取到 ${marketList.length} 个市场`);
      
      // 过滤出周期性市场
      const periodicMarkets = marketList.filter((m: any) => {
        const title = ((m.title || m.question || '')).toLowerCase();
        const hasBTC = title.includes('btc') || title.includes('bitcoin');
        const hasETH = title.includes('eth') || title.includes('ethereum');
        const has15min = title.includes('15') && (title.includes('min') || title.includes('minute'));
        const has1h = title.includes('1h') || (title.includes('1') && title.includes('hour'));
        const has1d = title.includes('1d') || (title.includes('1') && title.includes('day'));
        
        return (hasBTC || hasETH) && (has15min || has1h || has1d);
      });
      
      if (periodicMarkets.length > 0) {
        console.log(`\n🎯 找到 ${periodicMarkets.length} 个周期性市场:`);
        periodicMarkets.forEach((m: any, idx: number) => {
          console.log(`\n  [${idx + 1}] ${m.title || m.question}`);
          console.log(`      市场ID: ${m.id}`);
          console.log(`      所有字段:`, Object.keys(m).join(', '));
          
          // 检查是否有tags字段
          if (m.tags) {
            console.log(`      tags:`, JSON.stringify(m.tags));
          } else {
            console.log(`      tags: 不存在`);
          }
          
          // 检查events数组中的信息
          if (m.events && Array.isArray(m.events) && m.events.length > 0) {
            const event = m.events[0];
            if (event.tags) {
              console.log(`      events[0].tags:`, JSON.stringify(event.tags));
            }
          }
        });
      } else {
        console.log(`\n⚠️ 未找到周期性市场`);
      }
    } catch (error: any) {
      console.error(`❌ 搜索失败: ${error.message}`);
    }
    
    console.log('\n✅ 查找完成！');
  } catch (error) {
    console.error('❌ 查找失败:', error);
    throw error;
  }
}

findPeriodicTags();
