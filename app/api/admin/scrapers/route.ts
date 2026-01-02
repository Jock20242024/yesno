import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';
import { auth } from '@/lib/authExport';
import { randomUUID } from 'crypto';

export const dynamic = "force-dynamic";

/**
 * 获取所有采集源列表
 * GET /api/admin/scrapers
 */
export async function GET(request: NextRequest) {
  try {
    // 🔥 修复：添加权限验证
    let isAdmin = false;
    
    // 方案 1：检查 NextAuth session
    const session = await auth();
    if (session && session.user) {
      isAdmin = (session.user as any).isAdmin === true || (session.user as any).role === 'ADMIN';
    }
    
    // 方案 2：如果没有 NextAuth session，检查 adminToken
    if (!isAdmin) {
      const authResult = await verifyAdminToken(request);
      if (!authResult.success) {
        return createUnauthorizedResponse(
          authResult.error || 'Unauthorized. Admin access required.',
          authResult.statusCode || 401
        );
      }
      isAdmin = true;
    }
    
    if (!isAdmin) {
      return createUnauthorizedResponse(
        'Unauthorized. Admin access required.',
        401
      );
    }
    
    // 🔥 修复：先尝试查询，如果失败则初始化
    let dataSources: any[] = [];
    try {
      dataSources = await prisma.data_sources.findMany({
        orderBy: {
          sourceName: 'asc',
        },
      });
    } catch (dbError: any) {
      console.error('❌ [Admin Scrapers] 查询数据源失败:', dbError);
      console.error('❌ [Admin Scrapers] 错误代码:', dbError?.code);
      console.error('❌ [Admin Scrapers] 错误消息:', dbError?.message);
      // 即使查询失败，也尝试初始化（可能是数据库连接问题）
    }
    
    // 🔥 修复：强制检查并创建缺失的数据源（每次请求都检查）
    // 🔥 已删除"全网数据"占位符数据源，避免混淆（只保留实际可运行的采集源）
    const requiredSources = ['Polymarket'];
    const existingSourceNames = dataSources.map(ds => ds.sourceName);
    const missingSources = requiredSources.filter(name => !existingSourceNames.includes(name));
    
    if (missingSources.length > 0) {
      console.log('⚠️ [Admin Scrapers] 数据源缺失，开始初始化...');
      console.log('   缺失的数据源:', missingSources);
      console.log('   现有数据源:', existingSourceNames);
      
      try {
        const sourcesToCreate = [];
        
        if (missingSources.includes('Polymarket')) {
          sourcesToCreate.push({
            id: randomUUID(),
            sourceName: 'Polymarket',
            status: 'ACTIVE' as const,
            itemsCount: 0,
            multiplier: 1.0,
            config: JSON.stringify({
              apiUrl: 'https://gamma-api.polymarket.com/markets',
              defaultLimit: 100,
            }),
            updatedAt: new Date(),
          });
        }
        
        if (sourcesToCreate.length > 0) {
          // 🔥 使用 createMany + skipDuplicates，确保不会因为重复而失败
          try {
            await prisma.data_sources.createMany({
              data: sourcesToCreate,
              skipDuplicates: true, // 🔥 关键：跳过重复项
            });
            console.log(`✅ [Admin Scrapers] 已创建 ${sourcesToCreate.length} 个数据源`);
            
            // 重新查询
            try {
              dataSources = await prisma.data_sources.findMany({
                orderBy: {
                  sourceName: 'asc',
                },
              });
            } catch (reQueryError: any) {
              console.error('❌ [Admin Scrapers] 重新查询数据源失败:', reQueryError);
              // 即使重新查询失败，也继续使用现有数据源
            }
          } catch (createError: any) {
            console.error('❌ [Admin Scrapers] 创建数据源失败:', createError);
            console.error('❌ [Admin Scrapers] 错误代码:', createError?.code);
            if (createError?.code === 'P2002') {
              console.log('⚠️ [Admin Scrapers] 数据源已存在（唯一约束冲突），这是正常的');
            }
            // 即使创建失败，也继续返回现有的数据源
          }
        }
        
        console.log(`✅ [Admin Scrapers] 数据源初始化完成，共 ${dataSources.length} 个数据源`);
      } catch (initError: any) {
        console.error('❌ [Admin Scrapers] 初始化数据源失败:', initError);
        console.error('❌ [Admin Scrapers] 错误详情:', {
          message: initError?.message,
          stack: initError?.stack,
          code: initError?.code,
        });
        // 即使初始化失败，也继续返回现有的数据源（如果有）
      }
    }

    // 🔥 过滤掉"全网数据"占位符数据源，避免混淆
    const filteredDataSources = dataSources.filter(ds => ds.sourceName !== '全网数据');
    
    return NextResponse.json({
      success: true,
      data: filteredDataSources.map(ds => ({
        id: ds.id,
        sourceName: ds.sourceName,
        status: ds.status,
        lastSyncTime: ds.lastSyncTime?.toISOString() || null,
        itemsCount: ds.itemsCount,
        multiplier: ds.multiplier,
        errorMessage: ds.errorMessage,
        createdAt: ds.createdAt.toISOString(),
        updatedAt: ds.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('❌ [Admin Scrapers] 获取采集源列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取数据失败',
      },
      { status: 500 }
    );
  }
}
