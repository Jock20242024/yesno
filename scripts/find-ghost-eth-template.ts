/**
 * 🔥 临时脚本：查找并删除 ETH-15分钟 的"幽灵"模板记录
 * 
 * 用途：排查数据库中不可见的僵尸数据
 * 执行：npx tsx scripts/find-ghost-eth-template.ts
 */

import { prisma } from '../lib/prisma';

async function findAndDeleteGhostTemplates() {
  try {
    console.log('🔍 [Ghost Template Finder] 开始查找 ETH-15分钟 的幽灵模板...\n');
    
    // 🔥 第一步：查询所有模板，看看数据库里有什么
    const allTemplates = await prisma.marketTemplate.findMany({});
    console.log(`📊 [Ghost Template Finder] 数据库中共有 ${allTemplates.length} 个模板\n`);
    
    if (allTemplates.length > 0) {
      console.log('📋 所有模板列表：\n');
      allTemplates.forEach((t, idx) => {
        console.log(`   ${idx + 1}. ID=${t.id.substring(0, 8)}..., symbol="${t.symbol}", period=${t.period}, type=${t.type}, categorySlug=${t.categorySlug || '(无)'}, isActive=${t.isActive}`);
      });
      console.log('');
    }
    
    // 🔥 第二步：查询所有包含 'ETH' 的模板（symbol 可能是 'ETH' 或 'ETH/USD' 等格式）
    const allEthTemplates = await prisma.marketTemplate.findMany({
      where: {
        OR: [
          { symbol: { contains: 'ETH' } },
          { symbol: 'ETH' },
          { symbol: 'ETH/USD' },
        ],
      },
    });
    
    console.log(`📊 [Ghost Template Finder] 找到 ${allEthTemplates.length} 个包含 'ETH' 的模板（所有周期）\n`);
    
    // 先打印所有 ETH 模板，看看有哪些
    if (allEthTemplates.length > 0) {
      console.log('📋 所有包含 ETH 的模板详情：\n');
      allEthTemplates.forEach((t, idx) => {
        console.log(`   ${idx + 1}. symbol="${t.symbol}", period=${t.period} (类型: ${typeof t.period}), type=${t.type}, categorySlug=${t.categorySlug || '(无)'}, isActive=${t.isActive}, status=${(t as any).status || '(无)'}`);
      });
      console.log('');
    }
    
    // 🔥 第三步：过滤出 period=15 的记录（数字类型）
    const ethTemplates = allEthTemplates.filter(t => {
      const period = Number(t.period);
      return period === 15;
    });
    
    // 🔥 如果没找到，尝试查询所有 period=15 的模板（不管 symbol）
    if (ethTemplates.length === 0) {
      console.log('⚠️  未找到 symbol 包含 ETH 且 period=15 的模板');
      console.log('   尝试查询所有 period=15 的模板...\n');
      
      const allPeriod15Templates = await prisma.marketTemplate.findMany({
        where: {
          period: 15,
        },
      });
      
      console.log(`📊 [Ghost Template Finder] 找到 ${allPeriod15Templates.length} 个 period=15 的模板（所有 symbol）\n`);
      
      if (allPeriod15Templates.length > 0) {
        console.log('📋 所有 period=15 的模板详情：\n');
        allPeriod15Templates.forEach((t, idx) => {
          console.log(`   ${idx + 1}. symbol="${t.symbol}", period=${t.period}, type=${t.type}, categorySlug=${t.categorySlug || '(无)'}, isActive=${t.isActive}`);
        });
        console.log('');
      }
      
      // 🔥 检查是否有 symbol 为 'ETH' 或 'ETH/USD' 的模板（任何 period）
      console.log('🔍 检查是否有任何 ETH 相关的模板（所有周期）...\n');
      const anyEthTemplates = await prisma.marketTemplate.findMany({
        where: {
          OR: [
            { symbol: 'ETH' },
            { symbol: 'ETH/USD' },
            { symbol: { contains: 'ETH' } },
          ],
        },
      });
      
      if (anyEthTemplates.length > 0) {
        console.log(`⚠️  发现 ${anyEthTemplates.length} 个 ETH 相关模板（所有周期）：\n`);
        anyEthTemplates.forEach((t, idx) => {
          console.log(`   ${idx + 1}. symbol="${t.symbol}", period=${t.period}, type=${t.type}`);
        });
        console.log('');
      } else {
        console.log('✅ 确认：数据库中没有任何 ETH 相关的模板\n');
      }
    }
    
    console.log(`📊 [Ghost Template Finder] 找到 ${ethTemplates.length} 个 ETH-15分钟 模板记录：\n`);
    
    if (ethTemplates.length === 0) {
      console.log('✅ 未找到任何 ETH-15分钟 模板记录');
      return;
    }
    
    // 打印每个记录的详细信息
    ethTemplates.forEach((template, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 记录 #${index + 1}:`);
      console.log(`   ID: ${template.id}`);
      console.log(`   名称: ${template.name}`);
      console.log(`   中文名称: ${(template as any).nameZh || '(未设置)'}`);
      console.log(`   符号: ${template.symbol}`);
      console.log(`   周期: ${template.period} (类型: ${typeof template.period})`);
      console.log(`   类型: ${template.type}`);
      console.log(`   分类 Slug: ${template.categorySlug || '(未设置)'}`);
      console.log(`   是否激活: ${template.isActive}`);
      console.log(`   状态: ${(template as any).status || '(未设置)'}`);
      console.log(`   创建时间: ${template.createdAt.toISOString()}`);
      console.log(`   更新时间: ${template.updatedAt.toISOString()}`);
      console.log(`   失败次数: ${(template as any).failureCount || 0}`);
      console.log(`   暂停原因: ${(template as any).pauseReason || '(无)'}`);
      console.log(`   标题模板: ${template.titleTemplate || '(未设置)'}`);
      console.log(`   显示模板: ${(template as any).displayTemplate || '(未设置)'}`);
      console.log(`   外部ID模式: ${template.externalIdPattern || '(未设置)'}`);
      console.log(`   Oracle URL: ${template.oracleUrl || '(未设置)'}`);
      console.log(`   提前时间: ${template.advanceTime} 分钟`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
    
    // 🔥 分析为什么这些记录可能没有出现在管理列表中
    console.log('🔍 [Ghost Template Finder] 分析可能的原因：\n');
    
    const withoutCategory = ethTemplates.filter(t => !t.categorySlug);
    const inactive = ethTemplates.filter(t => !t.isActive);
    const paused = ethTemplates.filter(t => (t as any).status === 'PAUSED');
    
    if (withoutCategory.length > 0) {
      console.log(`⚠️  发现 ${withoutCategory.length} 个模板没有关联分类 (categorySlug 为空)`);
      console.log(`   这些模板可能因为缺少分类而在管理列表中不可见\n`);
    }
    
    if (inactive.length > 0) {
      console.log(`⚠️  发现 ${inactive.length} 个模板 isActive=false`);
      console.log(`   这些模板可能因为未激活而在管理列表中不可见\n`);
    }
    
    if (paused.length > 0) {
      console.log(`⚠️  发现 ${paused.length} 个模板状态为 PAUSED`);
      console.log(`   这些模板可能因为暂停而在管理列表中不可见\n`);
    }
    
    // 🔥 询问是否删除
    console.log('🗑️  [Ghost Template Finder] 准备删除这些记录...\n');
    
    // 执行删除
    const deleteResult = await prisma.marketTemplate.deleteMany({
      where: {
        symbol: 'ETH',
        OR: [
          { period: 15 },
        ],
      },
    });
    
    console.log(`✅ [Ghost Template Finder] 成功删除 ${deleteResult.count} 个 ETH-15分钟 模板记录\n`);
    
    // 验证删除结果
    const remaining = await prisma.marketTemplate.findMany({
      where: {
        symbol: 'ETH',
        OR: [
          { period: 15 },
        ],
      },
    });
    
    if (remaining.length === 0) {
      console.log('✅ [Ghost Template Finder] 验证通过：所有 ETH-15分钟 模板已彻底清除\n');
    } else {
      console.log(`⚠️  [Ghost Template Finder] 警告：仍有 ${remaining.length} 个记录未被删除\n`);
    }
    
  } catch (error) {
    console.error('❌ [Ghost Template Finder] 执行失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
findAndDeleteGhostTemplates();
