/**
 * 🔥 临时脚本：查询所有模板，检查唯一约束冲突
 * 
 * 用途：全面排查数据库中的模板记录
 * 执行：npx tsx scripts/check-all-templates.ts
 */

import { prisma } from '../lib/prisma';

async function checkAllTemplates() {
  try {
    console.log('🔍 [Template Checker] 开始全面检查所有模板...\n');
    
    // 查询所有模板
    const allTemplates = await prisma.marketTemplate.findMany({
      orderBy: [
        { symbol: 'asc' },
        { period: 'asc' },
      ],
    });
    
    console.log(`📊 [Template Checker] 数据库中共有 ${allTemplates.length} 个模板\n`);
    
    if (allTemplates.length === 0) {
      console.log('✅ 数据库中没有模板记录');
      return;
    }
    
    // 打印所有模板的详细信息
    console.log('📋 所有模板详情：\n');
    allTemplates.forEach((template, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 模板 #${index + 1}:`);
      console.log(`   ID: ${template.id}`);
      console.log(`   名称: ${template.name}`);
      console.log(`   中文名称: ${(template as any).nameZh || '(未设置)'}`);
      console.log(`   符号: "${template.symbol}"`);
      console.log(`   周期: ${template.period} (类型: ${typeof template.period})`);
      console.log(`   类型: ${template.type}`);
      console.log(`   分类 Slug: ${template.categorySlug || '(未设置)'}`);
      console.log(`   是否激活: ${template.isActive}`);
      console.log(`   状态: ${(template as any).status || '(未设置)'}`);
      console.log(`   创建时间: ${template.createdAt.toISOString()}`);
      console.log(`   更新时间: ${template.updatedAt.toISOString()}`);
      console.log(`   唯一约束组合: (symbol="${template.symbol}", period=${template.period}, type=${template.type})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
    
    // 🔥 检查唯一约束冲突：查找是否有相同的 (symbol, period, type) 组合
    console.log('🔍 [Template Checker] 检查唯一约束冲突...\n');
    
    const constraintMap = new Map<string, any[]>();
    allTemplates.forEach(t => {
      const key = `${t.symbol}|${t.period}|${t.type}`;
      if (!constraintMap.has(key)) {
        constraintMap.set(key, []);
      }
      constraintMap.get(key)!.push(t);
    });
    
    const conflicts: Array<{ key: string; templates: any[] }> = [];
    constraintMap.forEach((templates, key) => {
      if (templates.length > 1) {
        conflicts.push({ key, templates });
      }
    });
    
    if (conflicts.length > 0) {
      console.log(`⚠️  发现 ${conflicts.length} 个唯一约束冲突：\n`);
      conflicts.forEach((conflict, idx) => {
        console.log(`   冲突 #${idx + 1}: ${conflict.key}`);
        conflict.templates.forEach((t, tIdx) => {
          console.log(`     记录 ${tIdx + 1}: ID=${t.id.substring(0, 8)}..., name="${t.name}", categorySlug=${t.categorySlug || '(无)'}`);
        });
        console.log('');
      });
    } else {
      console.log('✅ 未发现唯一约束冲突\n');
    }
    
    // 🔥 检查是否有 ETH 相关的模板
    console.log('🔍 [Template Checker] 检查 ETH 相关模板...\n');
    const ethTemplates = allTemplates.filter(t => 
      t.symbol === 'ETH' || 
      t.symbol === 'ETH/USD' || 
      t.symbol.includes('ETH')
    );
    
    if (ethTemplates.length > 0) {
      console.log(`📊 找到 ${ethTemplates.length} 个 ETH 相关模板：\n`);
      ethTemplates.forEach((t, idx) => {
        console.log(`   ${idx + 1}. symbol="${t.symbol}", period=${t.period}, type=${t.type}, categorySlug=${t.categorySlug || '(无)'}`);
      });
      console.log('');
    } else {
      console.log('✅ 确认：数据库中没有 ETH 相关的模板\n');
    }
    
    // 🔥 检查 period=15 的模板
    console.log('🔍 [Template Checker] 检查 period=15 的模板...\n');
    const period15Templates = allTemplates.filter(t => Number(t.period) === 15);
    
    if (period15Templates.length > 0) {
      console.log(`📊 找到 ${period15Templates.length} 个 period=15 的模板：\n`);
      period15Templates.forEach((t, idx) => {
        console.log(`   ${idx + 1}. symbol="${t.symbol}", period=${t.period}, type=${t.type}, categorySlug=${t.categorySlug || '(无)'}`);
      });
      console.log('');
    } else {
      console.log('✅ 确认：数据库中没有 period=15 的模板\n');
    }
    
  } catch (error) {
    console.error('❌ [Template Checker] 执行失败:', error);
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
checkAllTemplates();
