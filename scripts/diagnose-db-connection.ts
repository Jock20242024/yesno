/**
 * 诊断数据库连接问题
 */

import { PrismaClient } from '@prisma/client';

async function diagnose() {
  console.log('=== 数据库连接诊断 ===\n');
  
  // 检查环境变量
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL 环境变量未设置');
    return;
  }
  
  // 解析 DATABASE_URL
  try {
    const url = new URL(dbUrl.replace('postgresql://', 'http://'));
    console.log('📊 DATABASE_URL 信息:');
    console.log(`   主机: ${url.hostname}`);
    console.log(`   端口: ${url.port}`);
    console.log(`   数据库: ${url.pathname.replace('/', '')}`);
    console.log(`   使用 Pooler: ${url.port === '6543' ? '是' : '否'}`);
    console.log('');
  } catch (e) {
    console.error('❌ DATABASE_URL 格式错误');
    return;
  }
  
  // 测试连接
  console.log('🔍 测试数据库连接...');
  const prisma = new PrismaClient({
    log: ['error'],
  });
  
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功\n');
    
    // 测试查询
    const userCount = await prisma.users.count();
    console.log(`✅ 用户表查询成功，共 ${userCount} 个用户`);
    
    // 检查数据源
    const dataSources = await prisma.data_sources.findMany({
      select: { sourceName: true, status: true },
    });
    console.log(`✅ 数据源表查询成功，共 ${dataSources.length} 个数据源:`);
    dataSources.forEach(ds => {
      console.log(`   - ${ds.sourceName} (${ds.status})`);
    });
    
    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ 数据库连接失败');
    console.error(`   错误代码: ${error.code || 'N/A'}`);
    console.error(`   错误消息: ${error.message}`);
    
    if (error.code === 'P1001') {
      console.error('\n⚠️ 无法连接到数据库服务器');
      console.error('建议：');
      console.error('1. 检查网络连接');
      console.error('2. 检查 Supabase 控制台确认数据库状态');
      console.error('3. 如果 pooler (6543) 不可用，尝试直接连接 (5432)');
      console.error('4. 检查防火墙设置');
    }
  }
}

diagnose();
