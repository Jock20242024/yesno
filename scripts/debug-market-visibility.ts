/**
 * 🔥 调试市场可见性问题
 * 
 * 用途：查询数据库中最新创建的那个审核通过的市场，检查其字段
 * 执行：npx tsx scripts/debug-market-visibility.ts
 */

import { prisma } from '../lib/prisma';
import dayjs from '../lib/dayjs';

async function debugMarketVisibility() {
  try {
    console.log('🔍 [Debug Market Visibility] 开始查询最新审核通过的市场...\n');
    
    // 查询最新创建的、审核通过的市场
    const latestMarket = await prisma.market.findFirst({
      where: {
        reviewStatus: 'PUBLISHED',
        isActive: true,
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    if (!latestMarket) {
      console.log('❌ [Debug Market Visibility] 未找到任何审核通过的市场\n');
      await prisma.$disconnect();
      return;
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 [Debug Market Visibility] 最新审核通过的市场详情:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 打印所有关键字段
    console.log('🔑 核心字段:');
    console.log(`   ID: ${latestMarket.id}`);
    console.log(`   标题: ${latestMarket.title}`);
    console.log(`   状态 (status): ${latestMarket.status}`);
    console.log(`   审核状态 (reviewStatus): ${latestMarket.reviewStatus}`);
    console.log(`   是否激活 (isActive): ${latestMarket.isActive}`);
    console.log(`   是否热门 (isHot): ${(latestMarket as any).isHot ?? false}`);
    console.log(`   模板ID (templateId): ${(latestMarket as any).templateId ?? 'null'}`);
    console.log(`   是否为工厂市场 (isFactory): ${(latestMarket as any).isFactory ?? false}`);
    console.log(`   周期 (period): ${(latestMarket as any).period ?? 'null'}`);
    console.log(`   来源 (source): ${latestMarket.source}`);
    console.log(`   结束时间 (closingDate): ${latestMarket.closingDate.toISOString()}`);
    console.log(`   创建时间 (createdAt): ${latestMarket.createdAt.toISOString()}`);
    console.log(`   更新时间 (updatedAt): ${latestMarket.updatedAt.toISOString()}`);
    console.log('\n');
    
    // 检查分类
    console.log('📂 分类关联:');
    if (latestMarket.categories && latestMarket.categories.length > 0) {
      latestMarket.categories.forEach((mc, idx) => {
        console.log(`   分类 #${idx + 1}:`);
        console.log(`      ID: ${mc.category.id}`);
        console.log(`      名称: ${mc.category.name}`);
        console.log(`      Slug: ${mc.category.slug}`);
      });
    } else {
      console.log('   ⚠️  未关联任何分类');
    }
    console.log('\n');
    
    // 验证点 1: categoryId 是否为"热门"的 ID
    console.log('✅ 验证点 1: categoryId 检查');
    const hotCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { slug: 'hot' },
          { name: { contains: '热门' } },
        ],
      },
    });
    
    if (hotCategory) {
      console.log(`   热门分类 ID: ${hotCategory.id}`);
      const hasHotCategory = latestMarket.categories?.some(mc => mc.category.id === hotCategory.id);
      console.log(`   是否关联热门分类: ${hasHotCategory ? '✅ 是' : '❌ 否'}`);
      
      if (!hasHotCategory && latestMarket.categories && latestMarket.categories.length > 0) {
        console.log(`   实际关联的分类: ${latestMarket.categories.map(mc => mc.category.name).join(', ')}`);
      }
    } else {
      console.log('   ⚠️  数据库中未找到"热门"分类');
    }
    console.log('\n');
    
    // 验证点 2: status 是否为 OPEN（不是 PENDING 或 CLOSED）
    console.log('✅ 验证点 2: status 检查');
    const isOpen = latestMarket.status === 'OPEN';
    console.log(`   当前状态: ${latestMarket.status}`);
    console.log(`   是否为 OPEN: ${isOpen ? '✅ 是' : '❌ 否'}`);
    if (!isOpen) {
      console.log(`   ⚠️  警告: 状态不是 OPEN，前端可能无法显示`);
    }
    console.log('\n');
    
    // 验证点 3: endTime 是否已过期
    console.log('✅ 验证点 3: endTime 检查');
    const now = dayjs.utc();
    const endTime = dayjs.utc(latestMarket.closingDate);
    const isExpired = endTime.isBefore(now);
    const timeUntilEnd = endTime.diff(now, 'hour', true);
    
    console.log(`   当前时间 (UTC): ${now.toISOString()}`);
    console.log(`   结束时间 (UTC): ${endTime.toISOString()}`);
    console.log(`   是否已过期: ${isExpired ? '❌ 是' : '✅ 否'}`);
    if (isExpired) {
      console.log(`   已过期时长: ${Math.abs(timeUntilEnd).toFixed(2)} 小时`);
    } else {
      console.log(`   剩余时长: ${timeUntilEnd.toFixed(2)} 小时`);
    }
    console.log('\n');
    
    // 验证点 4: templateId 检查
    console.log('✅ 验证点 4: templateId 检查');
    const templateId = (latestMarket as any).templateId;
    if (templateId) {
      console.log(`   有 templateId: ✅ ${templateId}`);
      console.log(`   应该参与聚合逻辑`);
    } else {
      console.log(`   templateId: null`);
      console.log(`   应该是独立市场，直接返回，不参与聚合`);
    }
    console.log('\n');
    
    // 验证点 5: isHot 检查
    console.log('✅ 验证点 5: isHot 检查');
    const isHot = (latestMarket as any).isHot ?? false;
    console.log(`   isHot 值: ${isHot}`);
    if (isHot) {
      console.log(`   ✅ 应该出现在热门列表中`);
    } else {
      const totalVolume = Number(latestMarket.totalVolume);
      console.log(`   总交易量: ${totalVolume}`);
      if (totalVolume > 100) {
        console.log(`   ✅ 交易量 > 100，也应该出现在热门列表中`);
      } else {
        console.log(`   ⚠️  不是热门且交易量 <= 100，不会出现在热门列表中`);
      }
    }
    console.log('\n');
    
    // 总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [Debug Market Visibility] 总结:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const issues: string[] = [];
    
    if (!isOpen) {
      issues.push('状态不是 OPEN');
    }
    
    if (isExpired) {
      issues.push('结束时间已过期');
    }
    
    if (!templateId && latestMarket.categories && latestMarket.categories.length > 0) {
      const hasHotCategory = latestMarket.categories.some(mc => mc.category.slug === 'hot' || mc.category.name.includes('热门'));
      if (!hasHotCategory && !isHot && Number(latestMarket.totalVolume) <= 100) {
        issues.push('未关联热门分类，且不是热门，且交易量 <= 100');
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ 所有验证点通过，市场应该能正常显示\n');
    } else {
      console.log('❌ 发现问题:');
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
      console.log('\n');
    }
    
  } catch (error) {
    console.error('❌ [Debug Market Visibility] 执行失败:', error);
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
debugMarketVisibility();
