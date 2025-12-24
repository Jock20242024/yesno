/**
 * 🔥 测试热门 API 是否能正确返回独立市场
 * 
 * 执行：npx tsx scripts/test-hot-api.ts
 */

async function testHotAPI() {
  try {
    console.log('🧪 [Test Hot API] 测试热门 API...\n');
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const url = `${apiUrl}/api/markets?category=hot&pageSize=100`;
    
    console.log(`📡 请求 URL: ${url}\n`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API 请求失败: ${response.status} ${response.statusText}`);
      console.error(`错误详情: ${errorText}\n`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ API 返回成功\n`);
    console.log(`📊 返回数据统计:`);
    console.log(`   总数量: ${data.data?.length || 0}`);
    console.log(`   hasMore: ${data.hasMore || false}`);
    console.log(`   total: ${data.total || 0}`);
    console.log('\n');
    
    // 检查独立市场
    const independentMarkets = (data.data || []).filter((m: any) => !m.templateId);
    const marketsWithTemplate = (data.data || []).filter((m: any) => m.templateId);
    
    console.log(`📋 市场类型分布:`);
    console.log(`   聚合项（有 templateId）: ${marketsWithTemplate.length} 个`);
    console.log(`   独立项（无 templateId）: ${independentMarkets.length} 个`);
    console.log('\n');
    
    if (independentMarkets.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 独立市场列表（前5个）:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      independentMarkets.slice(0, 5).forEach((market: any, idx: number) => {
        console.log(`   ${idx + 1}. ${market.title}`);
        console.log(`      ID: ${market.id}`);
        console.log(`      isHot: ${market.isHot ?? false}`);
        console.log(`      totalVolume: ${market.totalVolume}`);
        console.log(`      status: ${market.status}`);
        console.log('');
      });
    } else {
      console.log('⚠️  热门 API 中没有返回任何独立市场\n');
    }
    
    // 检查是否有我们已知的独立市场
    const knownIndependentIds = [
      'c7a8fef8-bd30-42d6-b75f-5f2e027bebef', // Will Trump deport...
      '56da1b97-25f5-44af-9042-6b26a084747e', // Will Stephen Smith...
      '529592e5-d2db-404d-8487-1399c4e37b27', // Will Elon Musk...
    ];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 检查已知独立市场是否在返回结果中:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const allMarketIds = (data.data || []).map((m: any) => m.id);
    knownIndependentIds.forEach(id => {
      const found = allMarketIds.includes(id);
      console.log(`   ${id.substring(0, 8)}... ${found ? '✅ 找到' : '❌ 未找到'}`);
    });
    console.log('\n');
    
  } catch (error) {
    console.error('❌ [Test Hot API] 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

testHotAPI();
