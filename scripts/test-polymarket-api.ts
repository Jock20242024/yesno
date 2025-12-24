/**
 * 测试 Polymarket API 连通性
 * 运行方式: npx tsx scripts/test-polymarket-api.ts
 */

async function testPolymarketAPI() {
  console.log('🧪 开始测试 Polymarket API 连通性...\n');

  const url = 'https://gamma-api.polymarket.com/markets?closed=false&limit=5';
  
  console.log(`📡 请求 URL: ${url}`);
  console.log(`⏰ 测试时间: ${new Date().toISOString()}\n`);

  try {
    console.log('🔄 发送请求...');
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // 设置超时（通过 AbortController）
    });

    const duration = Date.now() - startTime;
    
    console.log(`📥 响应状态: ${response.status} ${response.statusText}`);
    console.log(`⏱️  响应时间: ${duration}ms`);
    console.log(`📋 响应头:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ API 返回错误:`);
      console.error(`   状态码: ${response.status}`);
      console.error(`   状态文本: ${response.statusText}`);
      console.error(`   错误内容: ${errorText.substring(0, 500)}`);
      process.exit(1);
    }

    const data = await response.json();
    const isArray = Array.isArray(data);
    
    console.log(`\n✅ 请求成功!`);
    console.log(`   数据类型: ${isArray ? 'Array' : typeof data}`);
    console.log(`   数据长度: ${isArray ? data.length : 'N/A'}`);
    
    if (isArray && data.length > 0) {
      console.log(`\n📊 第一条数据示例:`);
      console.log(JSON.stringify(data[0], null, 2).substring(0, 500));
    }

    console.log('\n🎉 API 连通性测试通过！');
    
  } catch (error) {
    console.error('\n❌ 请求失败:');
    console.error(`   错误类型: ${error?.constructor?.name || 'Unknown'}`);
    console.error(`   错误消息: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      console.error('\n💡 可能的原因:');
      console.error('   1. 网络连接问题');
      console.error('   2. DNS 解析失败');
      console.error('   3. 防火墙阻止');
      console.error('   4. 需要代理（中国大陆环境）');
      console.error('\n💡 解决方案:');
      console.error('   如果在中国大陆，请设置代理环境变量:');
      console.error('   export HTTPS_PROXY=http://localhost:7890');
      console.error('   或在 .env 文件中添加: PROXY_URL=http://localhost:7890');
    }
    
    if (error instanceof Error && error.stack) {
      console.error(`\n   错误堆栈:\n${error.stack}`);
    }
    
    process.exit(1);
  }
}

testPolymarketAPI();
